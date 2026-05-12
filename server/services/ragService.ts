/**
 * RAG (Retrieval Augmented Generation) Service
 * Combines semantic search with Groq LLaMA for intelligent contract Q&A
 */

import { HuggingFaceEmbeddingService } from './huggingFaceEmbedding';
import { SemanticSearchService } from './semanticSearchService';
import { SystemSearchService } from './systemSearchService';
import { db } from '../db';
import { contracts, contractRules, contractCalculations, contractAnalysis } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface RAGQueryResult {
  answer: string;
  sources: Array<{
    contractId: string;
    contractName: string;
    relevantText: string;
    similarity: number;
  }>;
  confidence: number;
}

export class RAGService {
  /**
   * Answer a question about contracts using RAG
   */
  static async answerQuestion(
    question: string,
    contractId?: string
  ): Promise<RAGQueryResult> {
    try {
      console.log(`🤖 [RAG] Answering question: "${question}"`);
      
      const dataQueryResult = await this.handleDataQuery(question);
      if (dataQueryResult) {
        console.log(`📊 [RAG] Data query handled directly`);
        return dataQueryResult;
      }
      
      // Step 1: Try semantic search with fallback on embedding failures
      let contractMatches: any[] = [];
      let systemMatches: any[] = [];
      
      try {
        // Try semantic search first
        [contractMatches, systemMatches] = await Promise.all([
          SemanticSearchService.findMatchingContracts(question, {
            minSimilarity: 0.4,
            limit: 8,
          }),
          SystemSearchService.findMatchingDocumentation(question, {
            minSimilarity: 0.5,
            limit: 5,
          }),
        ]);
      } catch (embeddingError: any) {
        // Embedding service failed (HuggingFace timeout) - use fallback
        console.warn(`⚠️ [RAG] Embedding service failed, using text-based fallback: ${embeddingError.message}`);
        
        // Fallback: Use text-based search for system docs
        systemMatches = await SystemSearchService.findMatchingDocumentation(question, {
          minSimilarity: 0.3,
          limit: 5,
          useTextSearch: true, // Use keyword matching instead
        }).catch(() => []);
        
        // If we have a specific contract, use its data directly
        if (contractId) {
          const contractData = await db
            .select()
            .from(contracts)
            .where(eq(contracts.id, contractId))
            .limit(1);
          
          if (contractData.length > 0) {
            contractMatches = [{
              contractId: contractData[0].id,
              similarity: 0.8,
              embeddingType: 'fallback',
              sourceText: `Contract: ${contractData[0].displayName || contractData[0].originalName}`,
              metadata: {},
            }];
          }
        }
      }
      
      console.log(`📊 [RAG] Found ${contractMatches.length} contract matches, ${systemMatches.length} system docs matches`);
      
      // Step 2: Determine if this is a platform question or contract question
      // Use platform docs if: (1) no contract matches exist, OR (2) system match is strong (>0.7), OR (3) system similarity beats contract similarity
      const isPlatformQuestion = systemMatches.length > 0 && 
        (contractMatches.length === 0 || 
         systemMatches[0].similarity > 0.7 || 
         systemMatches[0].similarity > (contractMatches[0]?.similarity || 0));
      
      // Step 3: Build context from the most relevant source
      let context: string;
      let sources: any[];
      let confidence: number;
      
      if (isPlatformQuestion) {
        // Answer about the LicenseIQ platform itself
        console.log(`🏢 [RAG] Platform question detected - using system documentation`);
        context = systemMatches
          .slice(0, 5)
          .map((match, i) => `[${match.title}] ${match.sourceText}`)
          .join('\n\n');
        
        sources = systemMatches.slice(0, 3).map(match => ({
          contractId: 'system',
          contractName: `LicenseIQ Platform: ${match.category}`,
          relevantText: match.sourceText.substring(0, 200) + '...',
          similarity: match.similarity,
        }));
        
        confidence = systemMatches[0]?.similarity || 0.8;
      } else {
        // Answer about uploaded contracts
        console.log(`📄 [RAG] Contract question detected - using contract documents`);
        
        // Filter by contract if specified
        const filteredMatches = contractId
          ? contractMatches.filter(m => m.contractId === contractId)
          : contractMatches;
        
        if (filteredMatches.length === 0) {
          return {
            answer: "I couldn't find any relevant information in the contracts to answer your question.",
            sources: [],
            confidence: 0,
          };
        }
        
        context = filteredMatches
          .slice(0, 8)
          .map((match, i) => `[Section ${i + 1}] ${match.sourceText}`)
          .join('\n\n');
        
        // Get contract details for sources
        const contractIds = Array.from(new Set(filteredMatches.map(m => m.contractId)));
        const contractDetails = await db
          .select()
          .from(contracts)
          .where(eq(contracts.id, contractIds[0]));
        
        sources = filteredMatches.slice(0, 3).map(match => {
          let textContent = '';
          if (typeof match.sourceText === 'string') {
            textContent = match.sourceText;
          } else if (match.sourceText && typeof match.sourceText === 'object') {
            textContent = JSON.stringify(match.sourceText);
          }
          
          return {
            contractId: match.contractId,
            contractName: contractDetails.find(c => c.id === match.contractId)?.originalName || 'Unknown Contract',
            relevantText: textContent ? textContent.substring(0, 200) + '...' : 'No text available',
            similarity: match.similarity,
          };
        });
        
        confidence = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
      }
      
      // Step 4: Generate answer using Groq LLaMA
      const answer = await this.generateAnswer(question, context);
      
      console.log(`✅ [RAG] Answer generated with ${sources.length} sources (confidence: ${(confidence * 100).toFixed(1)}%)`);
      
      return {
        answer,
        sources,
        confidence,
      };
      
    } catch (error: any) {
      console.error('RAG query error:', error);
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }
  
  private static async handleDataQuery(question: string): Promise<RAGQueryResult | null> {
    const q = question.toLowerCase();
    
    const hasQueryIntent = /\b(my|our|list|show|how many|what are|tell me|give me|summarize|all|any|do i have|are there)\b/.test(q);
    const hasDataTarget = /\b(active|current|pending|contracts?|calculations?|rules?|agreements?|contract fee)\b/.test(q);
    const isContentQuery = /\b(fee rate|what does|clause say|section say|provision|paragraph|article|mean|define)\b/.test(q);
    const isDataQuery = hasQueryIntent && hasDataTarget && !isContentQuery;

    if (!isDataQuery) return null;

    try {
      if (/\bcontracts?\b|\bagreements?\b/.test(q)) {
        const typeFilterMap: Record<string, string[]> = {
          'rebate': ['rebate_incentive'],
          'incentive': ['rebate_incentive'],
          'royalty': ['licensing_royalty'],
          'license': ['licensing_royalty'],
          'licensing': ['licensing_royalty'],
          'distributor': ['distributor_reseller_program'],
          'reseller': ['distributor_reseller_program'],
          'oem': ['distributor_reseller_program'],
          'white.?label': ['distributor_reseller_program'],
          'plant.?nursery': ['plant_nursery'],
          'nursery': ['plant_nursery'],
        };

        let matchedTypes: string[] = [];
        let matchedLabel = '';
        for (const [keyword, types] of Object.entries(typeFilterMap)) {
          if (new RegExp(`\\b${keyword}\\b`, 'i').test(q)) {
            matchedTypes = [...new Set([...matchedTypes, ...types])];
            if (!matchedLabel) matchedLabel = keyword;
          }
        }

        const allContracts = await db
          .select({
            id: contracts.id,
            displayName: contracts.displayName,
            status: contracts.status,
            contractType: contracts.contractType,
            counterpartyName: contracts.counterpartyName,
            organizationName: contracts.organizationName,
            effectiveStart: contracts.effectiveStart,
            effectiveEnd: contracts.effectiveEnd,
          })
          .from(contracts)
          .orderBy(desc(contracts.createdAt));

        const stopWords = new Set(['give', 'me', 'list', 'of', 'show', 'my', 'all', 'the', 'a', 'an', 'our', 'what', 'are', 'tell', 'how', 'many', 'do', 'i', 'have', 'any', 'is', 'there', 'contracts', 'contract', 'agreements', 'agreement', 'rebate', 'royalty', 'license', 'licensing', 'distributor', 'reseller', 'oem', 'incentive', 'active', 'current', 'pending', 'for', 'from', 'with', 'by', 'in', 'to', 'and', 'or']);
        const queryWords = q.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));

        let companyFilter = '';
        if (queryWords.length > 0) {
          const uniqueNames = [...new Set(allContracts.map(c => c.counterpartyName).filter(Boolean))] as string[];
          for (const name of uniqueNames) {
            const nameLower = name.toLowerCase();
            const nameWords = nameLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/);
            for (const qw of queryWords) {
              if (nameWords.some(nw => nw.includes(qw) || qw.includes(nw)) ||
                  nameLower.includes(qw)) {
                companyFilter = name;
                break;
              }
            }
            if (companyFilter) break;
          }
          if (!companyFilter) {
            const uniqueOrgs = [...new Set(allContracts.map(c => c.organizationName).filter(Boolean))] as string[];
            for (const name of uniqueOrgs) {
              const nameLower = name.toLowerCase();
              for (const qw of queryWords) {
                if (nameLower.includes(qw)) {
                  companyFilter = name;
                  break;
                }
              }
              if (companyFilter) break;
            }
          }
        }

        let filteredContracts = allContracts;
        const filters: string[] = [];

        if (matchedTypes.length > 0) {
          filteredContracts = filteredContracts.filter(c =>
            matchedTypes.includes(c.contractType || '') ||
            matchedTypes.some(() => (c.displayName || '').toLowerCase().includes(matchedLabel))
          );
          filters.push(matchedLabel);
        }

        if (companyFilter) {
          filteredContracts = filteredContracts.filter(c =>
            (c.counterpartyName || '').toLowerCase() === companyFilter.toLowerCase() ||
            (c.organizationName || '').toLowerCase() === companyFilter.toLowerCase() ||
            (c.displayName || '').toLowerCase().includes(companyFilter.toLowerCase())
          );
          filters.push(companyFilter);
        }

        const hasFilters = matchedTypes.length > 0 || companyFilter;

        if (filteredContracts.length === 0 && hasFilters) {
          return {
            answer: `No contracts found matching "${filters.join(', ')}". You have ${allContracts.length} contract(s) total in the system.`,
            sources: [],
            confidence: 0.95,
          };
        }

        if (filteredContracts.length === 0) {
          return {
            answer: "You don't have any contracts in the system yet. You can create one from a template or upload a PDF contract.",
            sources: [],
            confidence: 0.95,
          };
        }

        const contractList = filteredContracts.map((c, i) => {
          const parts = [`${i + 1}. **${c.displayName || 'Unnamed Contract'}**`];
          if (c.counterpartyName) parts.push(`   - Counterparty: ${c.counterpartyName}`);
          if (c.contractType) parts.push(`   - Type: ${c.contractType}`);
          parts.push(`   - Status: ${c.status || 'unknown'}`);
          if (c.effectiveStart) parts.push(`   - Effective: ${new Date(c.effectiveStart).toLocaleDateString('en-US')}`);
          return parts.join('\n');
        }).join('\n\n');

        const filterDesc = companyFilter
          ? (matchedTypes.length > 0 ? ` ${matchedLabel}` : '') + ` contract${filteredContracts.length !== 1 ? 's' : ''} for ${companyFilter}`
          : (matchedTypes.length > 0 ? ` ${matchedLabel}` : '') + ` contract${filteredContracts.length !== 1 ? 's' : ''}`;
        const answer = `You have **${filteredContracts.length}${filterDesc}** in the system:\n\n${contractList}`;

        return {
          answer,
          sources: filteredContracts.slice(0, 3).map(c => ({
            contractId: c.id,
            contractName: c.displayName || 'Unknown',
            relevantText: `${c.displayName} - ${c.status}`,
            similarity: 1.0,
          })),
          confidence: 0.98,
        };
      }

      if (/\bcalculations?\b/.test(q)) {
        const calcs = await db
          .select({
            id: contractCalculations.id,
            contractId: contractCalculations.contractId,
            name: contractCalculations.name,
            totalRoyalty: contractCalculations.totalRoyalty,
            status: contractCalculations.status,
            createdAt: contractCalculations.createdAt,
          })
          .from(contractCalculations)
          .orderBy(desc(contractCalculations.createdAt));

        if (calcs.length === 0) {
          return {
            answer: "There are no calculations in the system yet. Upload sales data for a contract and run a calculation to get started.",
            sources: [],
            confidence: 0.95,
          };
        }

        const calcList = calcs.map((c, i) =>
          `${i + 1}. **${c.name}** — Total: $${Number(c.totalRoyalty || 0).toLocaleString()} — Status: ${c.status}`
        ).join('\n');

        return {
          answer: `You have **${calcs.length} calculation${calcs.length !== 1 ? 's' : ''}**:\n\n${calcList}`,
          sources: [],
          confidence: 0.98,
        };
      }

      if (/\brules?\b|\bcontract fee\b/.test(q)) {
        const rules = await db
          .select({
            id: contractRules.id,
            contractId: contractRules.contractId,
            ruleName: contractRules.ruleName,
            ruleType: contractRules.ruleType,
            baseRate: contractRules.baseRate,
            isActive: contractRules.isActive,
          })
          .from(contractRules)
          .orderBy(desc(contractRules.createdAt));

        if (rules.length === 0) {
          return {
            answer: "There are no contract fee rules in the system yet. Create a contract from a template or upload a PDF to extract rules.",
            sources: [],
            confidence: 0.95,
          };
        }

        const activeRules = rules.filter(r => r.isActive);
        const ruleList = activeRules.slice(0, 10).map((r, i) =>
          `${i + 1}. **${r.ruleName}** — Type: ${r.ruleType || 'N/A'} — Rate: ${r.baseRate ? (Number(r.baseRate) * 100).toFixed(1) + '%' : 'N/A'}`
        ).join('\n');

        return {
          answer: `You have **${activeRules.length} active rule${activeRules.length !== 1 ? 's' : ''}** (${rules.length} total):\n\n${ruleList}`,
          sources: [],
          confidence: 0.98,
        };
      }
    } catch (error: any) {
      console.warn(`⚠️ [RAG] Data query failed, falling back to semantic search:`, error.message);
      return null;
    }

    return null;
  }

  /**
   * Fallback: Generate answer from full contract when RAG confidence is low
   */
  private static async generateAnswerFromFullContract(question: string, contractId: string): Promise<string> {
    try {
      console.log(`📄 [RAG-FALLBACK] Starting full contract analysis for contract: ${contractId}`);
      
      // Import needed here to avoid circular dependency
      const { contractAnalysis } = await import('@shared/schema');
      
      // Get the full contract analysis
      const contractDetails = await db
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1);
      
      console.log(`📄 [RAG-FALLBACK] Found ${contractDetails.length} contracts`);
      
      if (contractDetails.length === 0) {
        console.log(`❌ [RAG-FALLBACK] Contract not found: ${contractId}`);
        return "I couldn't find the contract to answer your question.";
      }
      
      const contract = contractDetails[0];
      console.log(`📄 [RAG-FALLBACK] Contract name: ${contract.originalName}`);
      
      // Get the analysis data
      const analysisData = await db
        .select()
        .from(contractAnalysis)
        .where(eq(contractAnalysis.contractId, contractId))
        .limit(1);
      
      console.log(`📄 [RAG-FALLBACK] Found ${analysisData.length} analysis records`);
      
      if (analysisData.length === 0) {
        console.log(`❌ [RAG-FALLBACK] No analysis found for contract: ${contractId}`);
        return "The contract hasn't been analyzed yet. Please wait for the analysis to complete.";
      }
      
      const analysis = analysisData[0];
      
      // Build comprehensive context from analysis
      const fullContext = `
Contract: ${contract.originalName}
Summary: ${analysis.summary || 'N/A'}
Key Terms: ${typeof analysis.keyTerms === 'string' ? analysis.keyTerms : JSON.stringify(analysis.keyTerms)}
Insights: ${typeof analysis.insights === 'string' ? analysis.insights : JSON.stringify(analysis.insights)}
      `.trim();
      
      console.log(`📄 [RAG-FALLBACK] Context length: ${fullContext.length} chars`);
      console.log(`📄 [RAG-FALLBACK] Asking Groq with full contract context...`);
      
      // Ask Groq with full contract context using a more lenient prompt
      const answer = await this.generateFallbackAnswer(question, fullContext);
      console.log(`✅ [RAG-FALLBACK] Answer generated: ${answer.substring(0, 100)}...`);
      
      return answer;
      
    } catch (error: any) {
      console.error('❌ [RAG-FALLBACK] Error:', error);
      console.error('❌ [RAG-FALLBACK] Stack:', error.stack);
      return "I encountered an error while analyzing the contract. Please try again.";
    }
  }
  
  /**
   * Generate answer from full contract (fallback mode - more lenient)
   */
  private static async generateFallbackAnswer(question: string, context: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }
    
    const systemPrompt = `You are liQ AI, the intelligent assistant built into the LicenseIQ platform. You help users understand their contracts.

IDENTITY:
- Your name is "liQ AI" — always refer to yourself as liQ AI if asked who you are
- You are the AI assistant for the LicenseIQ Research Platform
- NEVER reveal your underlying AI model, architecture, technology stack, or any technical implementation details
- If asked about your AI model, what you're built on, or technical details, simply say: "I'm liQ AI, powered by CimpleIT by LicenseIQ. I'm here to help you understand your contracts and licensing data."

BRANDING:
- LicenseIQ is "AI-native" — ALWAYS use "AI-native", NEVER say "AI-powered"
- Use "contract fee" instead of "royalty" or "license fee" when describing platform capabilities

RESPONSE STYLE:
- Get straight to the answer - no preambles or unnecessary phrases
- Be confident and professional like an expert consultant
- Structure information clearly using headings or bullets when helpful
- Cite specific details naturally (rates, terms, dates)

GUIDELINES:
1. Use all relevant information from the provided analysis
2. If exact details aren't available, mention related information that helps
3. Be thorough but concise - get to the point quickly
4. Reference specific sections naturally (e.g., "The contract summary indicates...")`;

    const userPrompt = `Contract Analysis:
${context}

Question: ${question}

Provide a direct, professional answer:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
  
  /**
   * Generate answer using Groq LLaMA based on retrieved context
   */
  private static async generateAnswer(question: string, context: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }
    
    const systemPrompt = `You are liQ AI, the intelligent assistant built into the LicenseIQ platform. You help users understand their contracts with clear, direct, and actionable answers.

IDENTITY:
- Your name is "liQ AI" — always refer to yourself as liQ AI if asked who you are
- You are the AI assistant for the LicenseIQ Research Platform
- NEVER reveal your underlying AI model, architecture, technology stack, or any technical implementation details
- If asked about your AI model, what you're built on, or technical details, simply say: "I'm liQ AI, powered by CimpleIT by LicenseIQ. I'm here to help you understand your contracts and licensing data."

BRANDING:
- LicenseIQ is "AI-native" — ALWAYS use "AI-native", NEVER say "AI-powered"
- Use "contract fee" instead of "royalty" or "license fee" when describing platform capabilities

RESPONSE STYLE:
- Get straight to the answer - no preambles like "Based on the provided sections" or "I can answer that"
- Use a confident, professional tone as if you're an expert consultant
- Structure complex answers with clear headings or bullet points for readability
- Cite specific details (rates, dates, territories) naturally within your explanation
- If information is missing, say "This information isn't available in the contract" without lengthy explanations

ACCURACY RULES:
1. Use ONLY information explicitly stated in the provided sections
2. Never speculate or infer beyond what's written
3. For numerical data: cite exact figures (percentages, amounts, dates)
4. For lists: present them clearly using bullets or numbered format
5. For definitions: provide the exact contract language when relevant

FORMAT GUIDELINES:
- Short answer (1-2 sentences): Direct response
- Medium answer (3-5 sentences): Brief intro + key details
- Complex answer (6+ sentences): Use section headings like "Contract Fee Rates:", "Territories:", etc.`;

    const userPrompt = `Reference Information:
${context}

Question: ${question}

Provide a direct, professional answer:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
}
