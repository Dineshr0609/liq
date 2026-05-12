/**
 * Layout-Aware Chunking Service
 * 
 * Intelligent document parsing that detects and preserves:
 * - Tables (markdown, ASCII, and structured data)
 * - Headers and section boundaries
 * - Numbered lists and bullet points
 * - Paragraph boundaries
 * 
 * LAYMAN EXPLANATION:
 * Instead of blindly cutting a contract into pieces (which might split
 * a pricing table in half), this service understands document structure.
 * It keeps tables together, respects section boundaries, and ensures
 * AI gets complete, coherent chunks of text.
 */

export interface DocumentSection {
  id: string;
  type: 'header' | 'paragraph' | 'table' | 'list' | 'clause' | 'definition';
  level: number; // 1 = main section, 2 = subsection, etc.
  title?: string;
  content: string;
  startOffset: number;
  endOffset: number;
  pageNumber?: number;
  containsPaymentTerms: boolean;
  keywords: string[];
  tableData?: TableData;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  columnCount: number;
  rowCount: number;
}

export interface LayoutChunk {
  id: string;
  content: string;
  sections: DocumentSection[];
  pageNumbers: number[];
  containsPaymentTerms: boolean;
  keywords: string[];
  structureType: 'mixed' | 'table' | 'prose' | 'list';
  metadata: {
    sectionTitles: string[];
    hasTable: boolean;
    hasList: boolean;
    estimatedImportance: number; // 0-1 score
  };
}

/**
 * Detect page markers in text and return their positions
 * Looks for patterns like "Page 3", "Page 3 of 9", "3/9", "---Page 3---", etc.
 */
function detectPageMarkers(text: string): { offset: number; pageNumber: number }[] {
  const markers: { offset: number; pageNumber: number }[] = [];
  let match;
  
  // Pattern 1: "Page X" or "Page X of Y"
  const pagePattern = /(?:^|\n).*?Page\s+(\d+)(?:\s+of\s+\d+)?/gim;
  while ((match = pagePattern.exec(text)) !== null) {
    markers.push({ offset: match.index, pageNumber: parseInt(match[1], 10) });
  }
  
  // Pattern 2: "X/Y" format (common in PDF footers like "3/9")
  // Must be at end of line or followed by whitespace, and Y should be reasonable total
  const slashPattern = /(\d{1,2})\/(\d{1,2})(?:\s|$)/gm;
  while ((match = slashPattern.exec(text)) !== null) {
    const pageNum = parseInt(match[1], 10);
    const totalPages = parseInt(match[2], 10);
    // Validate: page number should be <= total, and total should be reasonable
    if (pageNum > 0 && pageNum <= totalPages && totalPages <= 100) {
      markers.push({ offset: match.index, pageNumber: pageNum });
    }
  }
  
  // Pattern 3: Standalone numbers on their own line (common in PDFs)
  // Only if no other page markers found
  if (markers.length === 0) {
    const standalonePattern = /(?:^|\n)\s*(\d{1,2})\s*(?:\n|$)/gm;
    while ((match = standalonePattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 100) {
        markers.push({ offset: match.index, pageNumber: num });
      }
    }
  }
  
  // Sort by offset
  markers.sort((a, b) => a.offset - b.offset);
  
  // Deduplicate consecutive same page numbers
  const uniqueMarkers: { offset: number; pageNumber: number }[] = [];
  for (const marker of markers) {
    const last = uniqueMarkers[uniqueMarkers.length - 1];
    if (!last || last.pageNumber !== marker.pageNumber) {
      uniqueMarkers.push(marker);
    }
  }
  
  console.log(`📄 [PAGE-DETECT] Found ${uniqueMarkers.length} unique page markers`);
  return uniqueMarkers;
}

/**
 * Get page number for a given text offset
 */
function getPageForOffset(offset: number, pageMarkers: { offset: number; pageNumber: number }[]): number {
  // Find the last page marker that comes before this offset
  let page = 1; // Default to page 1
  for (const marker of pageMarkers) {
    if (marker.offset <= offset) {
      page = marker.pageNumber;
    } else {
      break;
    }
  }
  return page;
}

// Payment-related keywords for relevance scoring
const PAYMENT_KEYWORDS = [
  'contract fee', 'royalties', 'payment', 'fee', 'fees', 'rate', 'rates',
  'percentage', 'percent', '%', 'tier', 'tiers', 'tiered',
  'volume', 'threshold', 'minimum', 'maximum', 'cap',
  'rebate', 'rebates', 'discount', 'discounts',
  'commission', 'commissions', 'margin', 'margins',
  'price', 'pricing', 'unit', 'per unit', 'per-unit',
  'container', 'gallon', 'pot', 'size',
  'annual', 'quarterly', 'monthly', 'period',
  'gross', 'net', 'revenue', 'sales',
  'contract fee', 'licensing fee', 'usage fee',
  'milestone', 'target', 'achievement', 'bonus',
  'schedule', 'exhibit', 'appendix'
];

/**
 * Detect markdown tables in text
 */
function detectMarkdownTables(text: string): { start: number; end: number; content: string; data: TableData }[] {
  const tables: { start: number; end: number; content: string; data: TableData }[] = [];
  
  // Pattern for markdown tables: header row, separator row (with |---|), data rows
  const tablePattern = /(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/gm;
  
  let match;
  while ((match = tablePattern.exec(text)) !== null) {
    const tableContent = match[1];
    const lines = tableContent.trim().split('\n');
    
    if (lines.length >= 2) {
      // Parse headers
      const headerLine = lines[0];
      const headers = headerLine.split('|').filter(h => h.trim()).map(h => h.trim());
      
      // Parse data rows (skip separator row at index 1)
      const rows: string[][] = [];
      for (let i = 2; i < lines.length; i++) {
        const rowCells = lines[i].split('|').filter(c => c.trim()).map(c => c.trim());
        if (rowCells.length > 0) {
          rows.push(rowCells);
        }
      }
      
      tables.push({
        start: match.index,
        end: match.index + tableContent.length,
        content: tableContent,
        data: {
          headers,
          rows,
          columnCount: headers.length,
          rowCount: rows.length
        }
      });
    }
  }
  
  return tables;
}

/**
 * Detect ASCII/text tables (using spaces/dashes for alignment)
 */
function detectAsciiTables(text: string): { start: number; end: number; content: string; data: TableData }[] {
  const tables: { start: number; end: number; content: string; data: TableData }[] = [];
  
  // Pattern for ASCII tables with dashed separators
  const dashLinePattern = /^[-=]{3,}$/gm;
  const lines = text.split('\n');
  
  let inTable = false;
  let tableStart = 0;
  let tableLines: string[] = [];
  let currentOffset = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    
    // Check if this looks like a table header separator
    if (/^[-=\s]{10,}$/.test(line) && !inTable) {
      // Look back for potential header
      if (i > 0 && lines[i - 1].includes('  ')) {
        inTable = true;
        tableStart = currentOffset - lines[i - 1].length - 1;
        tableLines = [lines[i - 1], line];
      }
    } else if (inTable) {
      // Check if we're still in a table (has multiple spaced columns or continuation)
      if (line.trim().length > 0 && (line.includes('  ') || /^\s*\|/.test(line))) {
        tableLines.push(line);
      } else if (/^[-=\s]{10,}$/.test(line)) {
        tableLines.push(line);
      } else {
        // End of table
        if (tableLines.length >= 3) {
          const content = tableLines.join('\n');
          // Parse simple table structure
          const headers = tableLines[0].split(/\s{2,}/).map(h => h.trim()).filter(h => h);
          const rows: string[][] = tableLines.slice(2)
            .filter(l => !/^[-=\s]+$/.test(l))
            .map(l => l.split(/\s{2,}/).map(c => c.trim()).filter(c => c));
          
          tables.push({
            start: tableStart,
            end: currentOffset,
            content,
            data: {
              headers,
              rows,
              columnCount: headers.length,
              rowCount: rows.length
            }
          });
        }
        inTable = false;
        tableLines = [];
      }
    }
    
    currentOffset += lineLength;
  }
  
  return tables;
}

/**
 * Detect section headers
 */
function detectHeaders(text: string): { offset: number; title: string; level: number }[] {
  const headers: { offset: number; title: string; level: number }[] = [];
  
  // Common header patterns
  const patterns = [
    // Markdown-style headers
    { regex: /^(#{1,6})\s+(.+)$/gm, levelFn: (m: RegExpExecArray) => m[1].length, titleFn: (m: RegExpExecArray) => m[2] },
    // SECTION N: Title or ARTICLE N
    { regex: /^(SECTION|ARTICLE|CHAPTER|PART)\s+(\d+|[IVXLC]+)[.:]\s*(.*)$/gim, levelFn: () => 1, titleFn: (m: RegExpExecArray) => `${m[1]} ${m[2]}: ${m[3]}` },
    // N.N Title (numbered sections)
    { regex: /^(\d+\.\d*)\s+([A-Z][^.\n]{3,})$/gm, levelFn: (m: RegExpExecArray) => m[1].split('.').length, titleFn: (m: RegExpExecArray) => m[2] },
    // ALL CAPS HEADERS
    { regex: /^([A-Z][A-Z\s]{5,})$/gm, levelFn: () => 1, titleFn: (m: RegExpExecArray) => m[1].trim() },
    // Exhibit/Schedule/Appendix
    { regex: /^(EXHIBIT|SCHEDULE|APPENDIX)\s+([A-Z0-9]+)[:\s-]*(.*)$/gim, levelFn: () => 1, titleFn: (m: RegExpExecArray) => `${m[1]} ${m[2]}${m[3] ? ': ' + m[3] : ''}` }
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      headers.push({
        offset: match.index,
        title: pattern.titleFn(match).trim(),
        level: pattern.levelFn(match)
      });
    }
  }
  
  // Sort by offset
  return headers.sort((a, b) => a.offset - b.offset);
}

/**
 * Detect numbered lists and bullet points
 */
function detectLists(text: string): { start: number; end: number; items: string[]; type: 'numbered' | 'bulleted' }[] {
  const lists: { start: number; end: number; items: string[]; type: 'numbered' | 'bulleted' }[] = [];
  
  // Numbered list pattern (1., 2., etc. or (a), (b), etc.)
  const numberedPattern = /(?:^|\n)((?:\s*(?:\d+\.|[a-z]\)|[(][a-z][)])\s+[^\n]+\n?)+)/gm;
  // Bulleted list pattern
  const bulletedPattern = /(?:^|\n)((?:\s*[-•*]\s+[^\n]+\n?)+)/gm;
  
  let match;
  while ((match = numberedPattern.exec(text)) !== null) {
    const items = match[1].split(/\n/).filter(l => l.trim());
    lists.push({
      start: match.index,
      end: match.index + match[1].length,
      items,
      type: 'numbered'
    });
  }
  
  while ((match = bulletedPattern.exec(text)) !== null) {
    const items = match[1].split(/\n/).filter(l => l.trim());
    lists.push({
      start: match.index,
      end: match.index + match[1].length,
      items,
      type: 'bulleted'
    });
  }
  
  return lists;
}

/**
 * Check if text contains payment-related keywords
 */
function containsPaymentKeywords(text: string): { contains: boolean; keywords: string[] } {
  const lowerText = text.toLowerCase();
  const found = PAYMENT_KEYWORDS.filter(kw => lowerText.includes(kw.toLowerCase()));
  return { contains: found.length > 0, keywords: found };
}

/**
 * Calculate importance score based on content
 */
function calculateImportance(section: DocumentSection): number {
  let score = 0.3; // Base score
  
  // Payment keywords boost
  if (section.containsPaymentTerms) {
    score += 0.3;
  }
  score += Math.min(section.keywords.length * 0.05, 0.2);
  
  // Tables are often important
  if (section.type === 'table') {
    score += 0.2;
  }
  
  // Section headers with payment-related titles
  if (section.title) {
    const titleLower = section.title.toLowerCase();
    if (/royalt|payment|fee|price|rate|commission|schedule|exhibit/i.test(titleLower)) {
      score += 0.2;
    }
  }
  
  return Math.min(score, 1);
}

/**
 * Parse document into layout-aware sections
 */
export function parseDocumentLayout(text: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let sectionId = 0;
  
  // Detect page markers first for accurate page assignment
  const pageMarkers = detectPageMarkers(text);
  console.log(`📄 [LAYOUT] Detected ${pageMarkers.length} page markers: ${pageMarkers.map(p => `Page ${p.pageNumber} @ offset ${p.offset}`).join(', ')}`);
  
  // Detect structural elements
  const markdownTables = detectMarkdownTables(text);
  const asciiTables = detectAsciiTables(text);
  const allTables = [...markdownTables, ...asciiTables].sort((a, b) => a.start - b.start);
  const headers = detectHeaders(text);
  const lists = detectLists(text);
  
  // Track which ranges are already claimed
  const claimed: { start: number; end: number }[] = [];
  
  // Add tables as sections first (they're most important to keep together)
  for (const table of allTables) {
    const { contains, keywords } = containsPaymentKeywords(table.content);
    const nearestHeader = headers.filter(h => h.offset < table.start).pop();
    const pageNumber = getPageForOffset(table.start, pageMarkers);
    
    sections.push({
      id: `section_${sectionId++}`,
      type: 'table',
      level: 2,
      title: nearestHeader?.title,
      content: table.content,
      startOffset: table.start,
      endOffset: table.end,
      pageNumber, // Now properly detected from page markers
      containsPaymentTerms: contains,
      keywords,
      tableData: table.data
    });
    
    claimed.push({ start: table.start, end: table.end });
  }
  
  // Add header-delimited sections for unclaimed areas
  let currentOffset = 0;
  
  for (let i = 0; i <= headers.length; i++) {
    const sectionStart = i === 0 ? 0 : headers[i - 1].offset;
    const sectionEnd = i === headers.length ? text.length : headers[i].offset;
    
    // Skip if this range overlaps with claimed areas
    if (claimed.some(c => (sectionStart < c.end && sectionEnd > c.start))) {
      continue;
    }
    
    const sectionContent = text.substring(sectionStart, sectionEnd).trim();
    if (sectionContent.length < 20) continue;
    
    const { contains, keywords } = containsPaymentKeywords(sectionContent);
    const pageNumber = getPageForOffset(sectionStart, pageMarkers);
    
    // Check if this is a list section
    const hasList = lists.some(l => l.start >= sectionStart && l.end <= sectionEnd);
    
    sections.push({
      id: `section_${sectionId++}`,
      type: hasList ? 'list' : 'paragraph',
      level: i > 0 ? headers[i - 1].level : 1,
      title: i > 0 ? headers[i - 1].title : undefined,
      content: sectionContent,
      startOffset: sectionStart,
      endOffset: sectionEnd,
      pageNumber, // Now properly detected from page markers
      containsPaymentTerms: contains,
      keywords
    });
  }
  
  // Sort by offset and calculate importance
  return sections
    .sort((a, b) => a.startOffset - b.startOffset)
    .map(s => ({ ...s, importance: calculateImportance(s) } as DocumentSection));
}

/**
 * Create layout-aware chunks from sections
 * Keeps related sections together, respects max chunk size
 */
export function createLayoutAwareChunks(
  text: string,
  options: { maxChunkSize?: number; overlapSize?: number } = {}
): LayoutChunk[] {
  const { maxChunkSize = 3000, overlapSize = 200 } = options;
  const sections = parseDocumentLayout(text);
  const chunks: LayoutChunk[] = [];
  let chunkId = 0;
  
  let currentSections: DocumentSection[] = [];
  let currentSize = 0;
  
  function finalizeChunk() {
    if (currentSections.length === 0) return;
    
    const content = currentSections.map(s => s.content).join('\n\n');
    const allKeywords = currentSections.flatMap(s => s.keywords);
    const uniqueKeywords = Array.from(new Set(allKeywords));
    
    const hasTable = currentSections.some(s => s.type === 'table');
    const hasList = currentSections.some(s => s.type === 'list');
    
    let structureType: 'mixed' | 'table' | 'prose' | 'list' = 'prose';
    if (hasTable && hasList) structureType = 'mixed';
    else if (hasTable) structureType = 'table';
    else if (hasList) structureType = 'list';
    
    const avgImportance = currentSections.reduce((acc, s) => acc + calculateImportance(s), 0) / currentSections.length;
    
    chunks.push({
      id: `chunk_${chunkId++}`,
      content,
      sections: currentSections,
      pageNumbers: [], // Would be populated if page detection is available
      containsPaymentTerms: currentSections.some(s => s.containsPaymentTerms),
      keywords: uniqueKeywords,
      structureType,
      metadata: {
        sectionTitles: currentSections.filter(s => s.title).map(s => s.title!),
        hasTable,
        hasList,
        estimatedImportance: avgImportance
      }
    });
    
    currentSections = [];
    currentSize = 0;
  }
  
  for (const section of sections) {
    // If this section alone exceeds max size, it becomes its own chunk
    if (section.content.length > maxChunkSize) {
      finalizeChunk();
      
      // For large sections (like big tables), keep them intact
      chunks.push({
        id: `chunk_${chunkId++}`,
        content: section.content,
        sections: [section],
        pageNumbers: section.pageNumber ? [section.pageNumber] : [],
        containsPaymentTerms: section.containsPaymentTerms,
        keywords: section.keywords,
        structureType: section.type === 'table' ? 'table' : 'prose',
        metadata: {
          sectionTitles: section.title ? [section.title] : [],
          hasTable: section.type === 'table',
          hasList: section.type === 'list',
          estimatedImportance: calculateImportance(section)
        }
      });
      continue;
    }
    
    // Check if adding this section would exceed max size
    if (currentSize + section.content.length + 2 > maxChunkSize) {
      finalizeChunk();
    }
    
    currentSections.push(section);
    currentSize += section.content.length + 2;
  }
  
  // Finalize last chunk
  finalizeChunk();
  
  return chunks;
}

/**
 * Get payment-relevant chunks sorted by importance
 */
export function getPaymentRelevantChunks(chunks: LayoutChunk[], limit?: number): LayoutChunk[] {
  return chunks
    .filter(c => c.containsPaymentTerms)
    .sort((a, b) => b.metadata.estimatedImportance - a.metadata.estimatedImportance)
    .slice(0, limit);
}

export const layoutAwareChunkingService = {
  parseDocumentLayout,
  createLayoutAwareChunks,
  getPaymentRelevantChunks,
  detectMarkdownTables,
  detectAsciiTables,
  detectHeaders,
  detectLists
};
