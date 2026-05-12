/**
 * RAG-Grounded Extraction Service
 * 
 * Implements Phase 2 from new_approach.md:
 * - Chunks contract text with page/section metadata
 * - Stores chunks with embeddings for retrieval
 * - Queries relevant chunks for payment rule extraction
 * - Sends only focused context to AI for extraction
 * 
 * LAYMAN EXPLANATION:
 * Instead of sending the entire 50-page contract to AI (which can confuse it),
 * we break it into small pieces (chunks), find only the pieces about payments,
 * and send JUST those pieces to AI. This means:
 * - AI focuses on relevant sections only
 * - Less chance of mixing up information from different sections
 * - Every extracted rule can be traced back to its exact source
 */

import { db } from '../db';
import { semanticIndexEntries, contractEmbeddings } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// Types
export interface ContractChunk {
  id: string;
  content: string;
  pageNumber: number;
  sectionName: string;
  chunkIndex: number;
  metadata: {
    startOffset: number;
    endOffset: number;
    containsPaymentTerms: boolean;
    keywords: string[];
  };
}

export interface RAGRetrievalResult {
  chunks: ContractChunk[];
  totalChunks: number;
  relevantChunks: number;
  retrievalQuery: string;
}

// Payment-related keywords for chunk classification
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
  'milestone', 'target', 'achievement', 'bonus'
];

/**
 * Chunk contract text into smaller pieces with metadata
 * 
 * LAYMAN: Think of this like cutting a book into pages and paragraphs,
 * but keeping track of which page each piece came from.
 */
export function chunkContractText(
  contractText: string,
  options: { chunkSize?: number; overlap?: number } = {}
): ContractChunk[] {
  const { chunkSize = 1500, overlap = 200 } = options;
  const chunks: ContractChunk[] = [];
  
  // Split by pages if page markers exist (e.g., "Page 3" or page breaks)
  const pagePattern = /(?:^|\n)(?:Page\s*(\d+)|---\s*Page\s*(\d+)\s*---|={3,})/gi;
  const pages: { pageNum: number; content: string; startOffset: number }[] = [];
  
  let lastIndex = 0;
  let currentPage = 1;
  let match;
  
  // Find all page markers
  const pageMarkers: { index: number; pageNum: number }[] = [];
  while ((match = pagePattern.exec(contractText)) !== null) {
    const pageNum = parseInt(match[1] || match[2]) || currentPage + 1;
    pageMarkers.push({ index: match.index, pageNum });
    currentPage = pageNum;
  }
  
  // If no page markers, treat as single page
  if (pageMarkers.length === 0) {
    pages.push({ pageNum: 1, content: contractText, startOffset: 0 });
  } else {
    // Split by page markers
    for (let i = 0; i < pageMarkers.length; i++) {
      const start = i === 0 ? 0 : pageMarkers[i - 1].index;
      const end = pageMarkers[i].index;
      if (end > start) {
        pages.push({
          pageNum: i === 0 ? 1 : pageMarkers[i - 1].pageNum,
          content: contractText.substring(start, end),
          startOffset: start
        });
      }
    }
    // Add last page
    const lastMarker = pageMarkers[pageMarkers.length - 1];
    pages.push({
      pageNum: lastMarker.pageNum,
      content: contractText.substring(lastMarker.index),
      startOffset: lastMarker.index
    });
  }
  
  // Chunk each page
  let chunkIndex = 0;
  for (const page of pages) {
    const pageContent = page.content;
    let offset = 0;
    
    while (offset < pageContent.length) {
      const end = Math.min(offset + chunkSize, pageContent.length);
      const chunkContent = pageContent.substring(offset, end).trim();
      
      if (chunkContent.length > 50) { // Skip tiny chunks
        // Detect section name from chunk content
        const sectionName = detectSectionName(chunkContent);
        
        // Check if chunk contains payment-related terms
        const lowerContent = chunkContent.toLowerCase();
        const foundKeywords = PAYMENT_KEYWORDS.filter(kw => lowerContent.includes(kw.toLowerCase()));
        const containsPaymentTerms = foundKeywords.length > 0;
        
        chunks.push({
          id: `chunk-${chunkIndex}`,
          content: chunkContent,
          pageNumber: page.pageNum,
          sectionName,
          chunkIndex,
          metadata: {
            startOffset: page.startOffset + offset,
            endOffset: page.startOffset + end,
            containsPaymentTerms,
            keywords: foundKeywords
          }
        });
        chunkIndex++;
      }
      
      // Move forward with overlap
      offset += chunkSize - overlap;
    }
  }
  
  return chunks;
}

/**
 * LAYOUT-AWARE CHUNKING
 * 
 * Industry-best approach that preserves table structures and section boundaries.
 * Used by enterprise players like Kira Systems and Icertis.
 * 
 * Key features:
 * 1. Detects tables (markdown, text-based, HTML)
 * 2. Keeps each table with its header as a single chunk
 * 3. Respects section boundaries (Tier 1, Tier 2, etc.)
 * 4. Falls back to regular chunking for prose sections
 */

interface TableBlock {
  header: string;          // e.g., "Tier 1 - Ornamental Trees"
  content: string;         // The full table including header
  startOffset: number;
  endOffset: number;
  tableType: 'markdown' | 'text' | 'html';
}

interface LayoutSection {
  type: 'table' | 'prose' | 'list';
  header: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Detect and extract all tables from contract text
 */
function detectTables(text: string): TableBlock[] {
  const tables: TableBlock[] = [];
  
  // Pattern 1: Markdown-style tables (|---|---|)
  const markdownTablePattern = /(?:^|\n)((?:[^\n]*\|[^\n]*\n)+(?:[^\n]*\|[^\n]*))/gm;
  
  // Pattern 2: Section headers followed by table-like content
  // Matches: "Tier X - Description:" or "X.X Section Name:" followed by structured data
  const tierHeaderPattern = /(?:^|\n)((?:Tier\s+\d+|Section\s+\d+(?:\.\d+)*|ARTICLE\s+[IVX\d]+)[^\n]*(?::|))\s*\n/gi;
  
  // Pattern 3: Text tables with consistent column separators (multiple spaces or tabs)
  const textTableRowPattern = /^[^\n]+(?:\s{2,}|\t)[^\n]+(?:\s{2,}|\t)[^\n]+$/gm;
  
  // Find markdown tables
  let match;
  while ((match = markdownTablePattern.exec(text)) !== null) {
    const tableContent = match[1];
    const startOffset = match.index;
    
    // Look backwards for the header (up to 200 chars before)
    const contextBefore = text.substring(Math.max(0, startOffset - 200), startOffset);
    const headerMatch = contextBefore.match(/(?:Tier\s+\d+[^\n]*|(?:\d+\.\d+)[^\n]*|[A-Z][a-z]+\s+[A-Z][a-z]+[^\n]*)(?:\n|$)/i);
    const header = headerMatch ? headerMatch[0].trim() : '';
    
    tables.push({
      header,
      content: header ? `${header}\n\n${tableContent}` : tableContent,
      startOffset: headerMatch ? startOffset - contextBefore.length + contextBefore.lastIndexOf(headerMatch[0]) : startOffset,
      endOffset: startOffset + tableContent.length,
      tableType: 'markdown'
    });
  }
  
  // Find tier sections with structured data
  const tierMatches: { index: number; header: string }[] = [];
  while ((match = tierHeaderPattern.exec(text)) !== null) {
    tierMatches.push({ index: match.index, header: match[1].trim() });
  }
  
  // Also detect generic section boundaries (for fallback end detection)
  const sectionBoundaryPattern = /(?:^|\n)\s*(\d+\.\d+\s+[A-Z][^\n]{10,}|[A-Z][A-Z\s]+:)\s*\n/gm;
  const sectionBoundaries: number[] = [];
  while ((match = sectionBoundaryPattern.exec(text)) !== null) {
    sectionBoundaries.push(match.index);
  }
  
  // For each tier header, capture content until the next tier, section, or natural boundary
  for (let i = 0; i < tierMatches.length; i++) {
    const start = tierMatches[i].index;
    
    // Find the end: next tier header, next section boundary, or end of document
    let end: number;
    if (i < tierMatches.length - 1) {
      end = tierMatches[i + 1].index;
    } else {
      // Find next section boundary after this tier
      const nextBoundary = sectionBoundaries.find(b => b > start + 50);
      end = nextBoundary || text.length;
    }
    
    const sectionContent = text.substring(start, end).trim();
    
    // Check if this section contains table-like structured data
    const hasTableStructure = 
      (sectionContent.match(/\|/g) || []).length >= 4 || // Has pipe separators
      (sectionContent.match(/\$[\d,]+\.?\d*/g) || []).length >= 2 || // Has multiple dollar amounts
      (sectionContent.match(/\d+\s*%/g) || []).length >= 2 || // Has multiple percentages
      (sectionContent.match(/\t/g) || []).length >= 4; // Has tab separators
    
    // Skip if already captured as markdown table
    const alreadyCaptured = tables.some(t => 
      t.startOffset <= start && t.endOffset >= end
    );
    
    if (hasTableStructure && !alreadyCaptured) {
      tables.push({
        header: tierMatches[i].header,
        content: sectionContent,
        startOffset: start,
        endOffset: end,
        tableType: 'text'
      });
    }
  }
  
  return tables.sort((a, b) => a.startOffset - b.startOffset);
}

/**
 * Estimate page number based on offset position in document
 * Detects various page marker patterns from PDF-to-text conversion
 */
function getPageNumberForOffset(text: string, offset: number): number {
  // Look for page markers before this offset
  const textBefore = text.substring(0, offset);
  
  // Multiple patterns to detect page numbers from various PDF converters
  const pagePatterns = [
    /(?:^|\n)\s*(?:Page|PAGE)\s*(\d+)\s*(?:of\s*\d+)?/gi,     // "Page 3" or "Page 3 of 10"
    /(?:^|\n)\s*-\s*(\d+)\s*-/g,                                // "- 3 -" (centered page numbers)
    /(?:^|\n)\s*(\d+)\s*$/gm,                                   // Standalone number at end of line
    /(?:file:\/\/[^\s]+\.html\s+)(\d+)\/\d+/gi,                 // PDF URL pattern "file://...html 3/9"
    /(?:^|\n)\s*[\[\(]?(\d+)[\]\)]?\s*(?:$|\n)/gm,              // [3] or (3) at line start/end
  ];
  
  let lastPage = 1;
  
  // Check for explicit "Page X" markers first (most reliable)
  const explicitPattern = /(?:Page|PAGE)\s+(\d+)/gi;
  let match;
  while ((match = explicitPattern.exec(textBefore)) !== null) {
    const pageNum = parseInt(match[1]);
    if (pageNum > 0 && pageNum <= 100) { // Reasonable page range
      lastPage = pageNum;
    }
  }
  
  // Also check for file path patterns with page numbers (from PDF HTML conversion)
  const pdfPathPattern = /(\d+)\/\d+\s*$/gm;
  while ((match = pdfPathPattern.exec(textBefore)) !== null) {
    const pageNum = parseInt(match[1]);
    if (pageNum > 0 && pageNum <= 100) {
      lastPage = pageNum;
    }
  }
  
  // Estimate based on character position if no markers found
  // Average ~3000 chars per page for contracts
  if (lastPage === 1 && offset > 3000) {
    lastPage = Math.max(1, Math.ceil(offset / 3000));
  }
  
  return lastPage;
}

/**
 * Layout-aware chunking that preserves table structures
 */
export function chunkContractTextLayoutAware(
  contractText: string,
  options: { maxChunkSize?: number; overlap?: number } = {}
): ContractChunk[] {
  const { maxChunkSize = 4000, overlap = 100 } = options;
  const chunks: ContractChunk[] = [];
  let chunkIndex = 0;
  
  console.log(`📐 [LAYOUT-AWARE] Starting layout-aware chunking (${contractText.length} chars)`);
  
  // Step 1: Detect all tables in the document
  const tables = detectTables(contractText);
  console.log(`📊 [LAYOUT-AWARE] Detected ${tables.length} table blocks`);
  
  // Step 2: Create chunks, keeping tables intact
  let currentOffset = 0;
  
  for (const table of tables) {
    // Chunk any prose BEFORE this table
    if (table.startOffset > currentOffset) {
      const proseContent = contractText.substring(currentOffset, table.startOffset).trim();
      if (proseContent.length > 50) {
        // Use standard chunking for prose sections
        const proseChunks = chunkProseSection(proseContent, currentOffset, chunkIndex, maxChunkSize, overlap, contractText);
        chunks.push(...proseChunks);
        chunkIndex += proseChunks.length;
      }
    }
    
    // Add the table as a single chunk (preserve structure)
    const tableChunk = createTableChunk(table, chunkIndex, contractText);
    chunks.push(tableChunk);
    chunkIndex++;
    console.log(`📋 [LAYOUT-AWARE] Table chunk: "${table.header.substring(0, 40)}..." (${table.content.length} chars, page ${tableChunk.pageNumber})`);
    
    currentOffset = table.endOffset;
  }
  
  // Chunk any remaining prose after the last table
  if (currentOffset < contractText.length) {
    const remainingContent = contractText.substring(currentOffset).trim();
    if (remainingContent.length > 50) {
      const remainingChunks = chunkProseSection(remainingContent, currentOffset, chunkIndex, maxChunkSize, overlap, contractText);
      chunks.push(...remainingChunks);
    }
  }
  
  console.log(`✅ [LAYOUT-AWARE] Created ${chunks.length} layout-aware chunks (${tables.length} table blocks preserved)`);
  
  return chunks;
}

/**
 * Chunk prose (non-table) sections with standard approach
 */
function chunkProseSection(
  content: string, 
  baseOffset: number, 
  startIndex: number,
  maxChunkSize: number,
  overlap: number,
  fullText: string
): ContractChunk[] {
  const chunks: ContractChunk[] = [];
  let offset = 0;
  let index = startIndex;
  
  while (offset < content.length) {
    const end = Math.min(offset + maxChunkSize, content.length);
    const chunkContent = content.substring(offset, end).trim();
    
    if (chunkContent.length > 50) {
      const sectionName = detectSectionName(chunkContent);
      const lowerContent = chunkContent.toLowerCase();
      const foundKeywords = PAYMENT_KEYWORDS.filter(kw => lowerContent.includes(kw.toLowerCase()));
      
      // Calculate page number based on offset in full document
      const pageNumber = getPageNumberForOffset(fullText, baseOffset + offset);
      
      chunks.push({
        id: `chunk-${index}`,
        content: chunkContent,
        pageNumber,
        sectionName,
        chunkIndex: index,
        metadata: {
          startOffset: baseOffset + offset,
          endOffset: baseOffset + end,
          containsPaymentTerms: foundKeywords.length > 0,
          keywords: foundKeywords
        }
      });
      index++;
    }
    
    offset += maxChunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Create a chunk from a detected table block
 */
function createTableChunk(table: TableBlock, index: number, fullText: string): ContractChunk {
  const lowerContent = table.content.toLowerCase();
  const foundKeywords = PAYMENT_KEYWORDS.filter(kw => lowerContent.includes(kw.toLowerCase()));
  
  // Calculate page number based on table's position in the document
  const pageNumber = getPageNumberForOffset(fullText, table.startOffset);
  
  return {
    id: `table-chunk-${index}`,
    content: table.content,
    pageNumber,
    sectionName: table.header || 'Pricing Table',
    chunkIndex: index,
    metadata: {
      startOffset: table.startOffset,
      endOffset: table.endOffset,
      containsPaymentTerms: true, // Tables are always payment-relevant
      keywords: [...foundKeywords, `table:${table.tableType}`, `tier:${table.header}`]
    }
  };
}

/**
 * Detect section name from chunk content
 */
function detectSectionName(content: string): string {
  // Look for section headers
  const sectionPatterns = [
    /^(?:ARTICLE|SECTION|PART)\s+([IVX\d]+)[.:]\s*([^\n]+)/im,
    /^(\d+(?:\.\d+)*)[.:]\s*([^\n]+)/m,
    /^([A-Z][A-Z\s]+)(?:\n|$)/m
  ];
  
  for (const pattern of sectionPatterns) {
    const match = content.match(pattern);
    if (match) {
      return (match[2] || match[1]).trim().substring(0, 50);
    }
  }
  
  return 'General';
}

/**
 * Generate embedding for a text chunk using HuggingFace
 */
async function generateChunkEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.warn('[RAG] No HuggingFace API key - skipping embedding');
      return null;
    }
    
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text.substring(0, 512) // Limit input length
        })
      }
    );
    
    if (!response.ok) {
      console.warn(`[RAG] Embedding API error: ${response.status}`);
      return null;
    }
    
    const embedding = await response.json();
    return Array.isArray(embedding) ? embedding : null;
  } catch (error) {
    console.error('[RAG] Embedding generation failed:', error);
    return null;
  }
}

/**
 * Store contract chunks with embeddings for RAG retrieval
 * 
 * LAYMAN: Save all the pieces of the contract in a searchable database,
 * so we can quickly find relevant pieces later.
 */
export async function storeContractChunks(
  contractId: string,
  chunks: ContractChunk[]
): Promise<{ stored: number; failed: number }> {
  let stored = 0;
  let failed = 0;
  
  console.log(`[RAG] Storing ${chunks.length} chunks for contract ${contractId}`);
  
  // Delete existing chunks for this contract
  await db.delete(semanticIndexEntries)
    .where(and(
      eq(semanticIndexEntries.contractId, contractId),
      eq(semanticIndexEntries.indexType, 'document_chunk')
    ));
  
  // Store each chunk with embedding
  for (const chunk of chunks) {
    try {
      const embedding = await generateChunkEmbedding(chunk.content);
      
      await db.insert(semanticIndexEntries).values({
        contractId,
        indexType: 'document_chunk',
        sourceId: chunk.id,
        content: chunk.content,
        embedding: embedding || undefined,
        metadata: {
          pageNumber: chunk.pageNumber,
          sectionName: chunk.sectionName,
          chunkIndex: chunk.chunkIndex,
          containsPaymentTerms: chunk.metadata.containsPaymentTerms,
          keywords: chunk.metadata.keywords,
          startOffset: chunk.metadata.startOffset,
          endOffset: chunk.metadata.endOffset
        }
      });
      stored++;
    } catch (error) {
      console.error(`[RAG] Failed to store chunk ${chunk.id}:`, error);
      failed++;
    }
  }
  
  console.log(`[RAG] Stored ${stored} chunks, ${failed} failed`);
  return { stored, failed };
}

/**
 * Retrieve payment-related chunks using VECTOR SIMILARITY search
 * 
 * LAYMAN: Use AI-native search to find the most relevant payment sections.
 * The system compares the meaning of "payment terms" against each chunk
 * to find the best matches, rather than just looking for keywords.
 */
export async function retrievePaymentChunksWithEmbeddings(
  contractId: string,
  queryText: string = 'payment terms, fee rates, fee schedules, pricing tiers',
  maxResults: number = 15
): Promise<RAGRetrievalResult> {
  console.log(`[RAG] Retrieving chunks via VECTOR SIMILARITY for contract ${contractId}`);
  
  // Generate embedding for the query
  const queryEmbedding = await generateChunkEmbedding(queryText);
  
  if (!queryEmbedding) {
    console.warn('[RAG] No query embedding available, falling back to keyword search');
    return retrievePaymentChunks(contractId, { maxChunks: maxResults });
  }
  
  // Use cosine similarity to find most relevant chunks
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  try {
    const similarChunks = await db.select({
      id: semanticIndexEntries.id,
      sourceId: semanticIndexEntries.sourceId,
      content: semanticIndexEntries.content,
      metadata: semanticIndexEntries.metadata,
      similarity: sql<number>`1 - (embedding <=> ${embeddingStr}::vector)`
    })
    .from(semanticIndexEntries)
    .where(and(
      eq(semanticIndexEntries.contractId, contractId),
      eq(semanticIndexEntries.indexType, 'document_chunk'),
      sql`embedding IS NOT NULL`
    ))
    .orderBy(sql`embedding <=> ${embeddingStr}::vector`)
    .limit(maxResults);
    
    console.log(`[RAG] Found ${similarChunks.length} chunks via vector similarity`);
    
    // Convert to ContractChunk format
    const chunks: ContractChunk[] = similarChunks.map((chunk, idx) => {
      const meta = chunk.metadata as any;
      return {
        id: chunk.sourceId || chunk.id,
        content: chunk.content,
        pageNumber: meta?.pageNumber || 1,
        sectionName: meta?.sectionName || 'Unknown',
        chunkIndex: meta?.chunkIndex || idx,
        metadata: {
          startOffset: meta?.startOffset || 0,
          endOffset: meta?.endOffset || 0,
          containsPaymentTerms: meta?.containsPaymentTerms || false,
          keywords: meta?.keywords || [],
          similarity: (chunk as any).similarity
        }
      };
    });
    
    return {
      chunks,
      totalChunks: chunks.length,
      relevantChunks: chunks.length,
      retrievalQuery: queryText
    };
  } catch (error) {
    console.error('[RAG] Vector similarity search failed, falling back to keyword search:', error);
    return retrievePaymentChunks(contractId, { maxChunks: maxResults });
  }
}

/**
 * Retrieve payment-related chunks for rule extraction (KEYWORD FALLBACK)
 * 
 * LAYMAN: Search our database for all the pieces about payments,
 * so we can send ONLY those pieces to AI for extraction.
 * 
 * NOTE: This is the fallback method when embeddings are not available.
 * Prefer retrievePaymentChunksWithEmbeddings() for better accuracy.
 */
export async function retrievePaymentChunks(
  contractId: string,
  options: { maxChunks?: number; includeNearbyContext?: boolean } = {}
): Promise<RAGRetrievalResult> {
  const { maxChunks = 20, includeNearbyContext = true } = options;
  
  console.log(`[RAG] Retrieving payment chunks via KEYWORD FILTER for contract ${contractId}`);
  console.warn('[RAG] ⚠️ Using keyword fallback - vector similarity not available');
  
  // Get all chunks for this contract
  const allChunks = await db.select()
    .from(semanticIndexEntries)
    .where(and(
      eq(semanticIndexEntries.contractId, contractId),
      eq(semanticIndexEntries.indexType, 'document_chunk')
    ))
    .orderBy(sql`(metadata->>'chunkIndex')::int`);
  
  if (allChunks.length === 0) {
    console.log(`[RAG] No chunks found for contract ${contractId}`);
    return {
      chunks: [],
      totalChunks: 0,
      relevantChunks: 0,
      retrievalQuery: 'payment terms'
    };
  }
  
  // Filter to payment-related chunks
  const paymentChunks = allChunks.filter(chunk => {
    const meta = chunk.metadata as any;
    return meta?.containsPaymentTerms === true;
  });
  
  // If we want nearby context, include chunks adjacent to payment chunks
  let relevantChunks = paymentChunks;
  if (includeNearbyContext && paymentChunks.length > 0) {
    const paymentIndices = new Set(
      paymentChunks.map(c => (c.metadata as any)?.chunkIndex)
    );
    
    // Include chunks immediately before/after payment chunks
    relevantChunks = allChunks.filter(chunk => {
      const idx = (chunk.metadata as any)?.chunkIndex;
      return paymentIndices.has(idx) || 
             paymentIndices.has(idx - 1) || 
             paymentIndices.has(idx + 1);
    });
  }
  
  // Limit to maxChunks
  const limitedChunks = relevantChunks.slice(0, maxChunks);
  
  // Convert to ContractChunk format
  const result: ContractChunk[] = limitedChunks.map(chunk => {
    const meta = chunk.metadata as any;
    return {
      id: chunk.sourceId || chunk.id,
      content: chunk.content,
      pageNumber: meta?.pageNumber || 1,
      sectionName: meta?.sectionName || 'Unknown',
      chunkIndex: meta?.chunkIndex || 0,
      metadata: {
        startOffset: meta?.startOffset || 0,
        endOffset: meta?.endOffset || 0,
        containsPaymentTerms: meta?.containsPaymentTerms || false,
        keywords: meta?.keywords || []
      }
    };
  });
  
  console.log(`[RAG] Found ${result.length} relevant chunks out of ${allChunks.length} total`);
  
  return {
    chunks: result,
    totalChunks: allChunks.length,
    relevantChunks: result.length,
    retrievalQuery: 'payment terms, royalty, fees, tiers, pricing'
  };
}

/**
 * Build focused context from retrieved chunks for AI extraction
 * 
 * LAYMAN: Combine the relevant pieces into a focused document
 * that AI can understand easily.
 */
export function buildExtractionContext(chunks: ContractChunk[]): string {
  if (chunks.length === 0) {
    return '';
  }
  
  // Sort by page and chunk index
  const sorted = [...chunks].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.chunkIndex - b.chunkIndex;
  });
  
  // Build context with clear section markers
  const sections: string[] = [];
  let currentPage = -1;
  let currentSection = '';
  
  for (const chunk of sorted) {
    // Add page marker
    if (chunk.pageNumber !== currentPage) {
      sections.push(`\n--- Page ${chunk.pageNumber} ---\n`);
      currentPage = chunk.pageNumber;
    }
    
    // Add section marker if changed
    if (chunk.sectionName !== currentSection && chunk.sectionName !== 'General') {
      sections.push(`[Section: ${chunk.sectionName}]\n`);
      currentSection = chunk.sectionName;
    }
    
    // Add chunk content
    sections.push(chunk.content);
    sections.push('\n');
  }
  
  return sections.join('');
}

/**
 * Main RAG-grounded extraction function
 * 
 * This is the complete flow:
 * 1. Retrieve relevant chunks from vector DB using EMBEDDING SIMILARITY
 * 2. Build focused context
 * 3. Return context for AI extraction
 * 
 * LAYMAN: Get just the payment-related pieces and combine them
 * into a focused document for AI to read.
 * 
 * Uses vector similarity (embedding comparison) for accurate retrieval,
 * with keyword-based fallback if embeddings are unavailable.
 */
export async function getRAGGroundedContext(
  contractId: string
): Promise<{
  context: string;
  chunks: ContractChunk[];
  metadata: {
    totalChunks: number;
    relevantChunks: number;
    retrievalMethod: string;
  };
}> {
  // Try vector similarity first (preferred), fall back to keyword filter
  const retrieval = await retrievePaymentChunksWithEmbeddings(contractId);
  
  if (retrieval.chunks.length === 0) {
    console.log('[RAG] No chunks found, falling back to full text extraction');
    return {
      context: '',
      chunks: [],
      metadata: {
        totalChunks: 0,
        relevantChunks: 0,
        retrievalMethod: 'fallback_full_text'
      }
    };
  }
  
  // Build focused context
  const context = buildExtractionContext(retrieval.chunks);
  
  console.log(`[RAG] Built extraction context: ${context.length} chars from ${retrieval.chunks.length} chunks`);
  
  return {
    context,
    chunks: retrieval.chunks,
    metadata: {
      totalChunks: retrieval.totalChunks,
      relevantChunks: retrieval.relevantChunks,
      retrievalMethod: 'rag_retrieval'
    }
  };
}

/**
 * Process contract for RAG: chunk and store
 * Call this after contract text extraction
 */
export async function prepareContractForRAG(
  contractId: string,
  contractText: string,
  options: { fastMode?: boolean } = {}
): Promise<{
  chunksCreated: number;
  paymentChunks: number;
  chunks?: ContractChunk[];
}> {
  const { fastMode = true } = options; // Default to fast mode
  console.log(`[RAG] Preparing contract ${contractId} for RAG extraction (fastMode=${fastMode})`);
  
  // Chunk the contract
  const chunks = chunkContractText(contractText);
  const paymentChunks = chunks.filter(c => c.metadata.containsPaymentTerms);
  
  console.log(`[RAG] Created ${chunks.length} chunks, ${paymentChunks.length} contain payment terms`);
  
  if (fastMode) {
    // FAST MODE: Skip embedding generation, return payment chunks directly
    console.log(`[RAG-FAST] Skipping embedding generation, using keyword-matched chunks directly`);
    return {
      chunksCreated: chunks.length,
      paymentChunks: paymentChunks.length,
      chunks: paymentChunks // Return payment chunks for immediate use
    };
  }
  
  // FULL MODE: Store chunks with embeddings (slower but more accurate)
  await storeContractChunks(contractId, chunks);
  
  return {
    chunksCreated: chunks.length,
    paymentChunks: paymentChunks.length
  };
}

/**
 * FAST extraction - keyword-based chunk selection without embeddings
 * Industry best practice for speed: Use simple keyword matching for initial filtering
 */
export async function getPaymentChunksFast(
  contractId: string,
  contractText: string
): Promise<RAGRetrievalResult> {
  console.log(`[RAG-FAST] Fast extraction for contract ${contractId}`);
  
  // Chunk and filter in memory - no database calls, no embedding API calls
  const chunks = chunkContractText(contractText);
  const paymentChunks = chunks.filter(c => c.metadata.containsPaymentTerms);
  
  // Sort by keyword density (most relevant first)
  paymentChunks.sort((a, b) => b.metadata.keywords.length - a.metadata.keywords.length);
  
  console.log(`[RAG-FAST] Found ${paymentChunks.length} payment-related chunks (no API calls needed)`);
  
  return {
    chunks: paymentChunks.slice(0, 15), // Limit to top 15 most relevant
    totalChunks: chunks.length,
    relevantChunks: paymentChunks.length,
    retrievalQuery: 'keyword-based (fast mode)'
  };
}

export const ragExtractionService = {
  chunkContractText,
  chunkContractTextLayoutAware,
  storeContractChunks,
  retrievePaymentChunks,
  retrievePaymentChunksWithEmbeddings,
  buildExtractionContext,
  getRAGGroundedContext,
  prepareContractForRAG,
  getPaymentChunksFast
};
