/**
 * AI Provider Service
 * 
 * Unified interface for AI operations that routes to the configured provider:
 * - Anthropic Claude (default) - claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5
 * - Groq - llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
 * - OpenAI - gpt-4o, gpt-4o-mini
 * 
 * Configuration is read from system_settings table (aiProvider, aiModel fields)
 */

import { GroqService } from './groqService.js';
import { OpenAIService } from './openaiService';
import { ClaudeService } from './claudeService';
import { db } from '../db';
import { systemSettings } from '../../shared/schema';

export interface ContractAnalysisResult {
  summary: string;
  keyTerms: { type: string; description: string; confidence: number; location: string; }[];
  riskAnalysis: any[];
  insights: any[];
  confidence: number;
}

export interface LicenseRuleExtractionResult {
  documentType: string;
  contractCategory?: string;
  licenseType: string;
  parties: {
    licensor: string;
    licensee: string;
  };
  effectiveDate?: string;
  expirationDate?: string;
  rules: Array<{
    ruleType: string;
    ruleName: string;
    description: string;
    conditions: any;
    calculation: any;
    priority: number;
    sourceSpan: any;
    confidence: number;
    formulaDefinition?: any;
  }>;
  currency: string;
  paymentTerms: string;
  reportingRequirements: any[];
  extractionMetadata: {
    totalRulesFound: number;
    avgConfidence: number;
    processingTime: number;
    ruleComplexity: 'simple' | 'moderate' | 'complex';
    hasFixedPricing?: boolean;
    hasVariablePricing?: boolean;
    hasTieredPricing?: boolean;
    hasRenewalTerms?: boolean;
    hasTerminationClauses?: boolean;
  };
}

export interface AIProvider {
  analyzeContract(contractText: string): Promise<ContractAnalysisResult>;
  extractDetailedContractRules(contractText: string, contractTypeCode?: string): Promise<LicenseRuleExtractionResult>;
}

// Provider configuration type
interface AIConfig {
  provider: 'anthropic' | 'groq' | 'openai';
  model: string;
  temperature: number;
  maxTokens: number;
  retryAttempts: number;
}

// Default configuration (Claude as default)
const DEFAULT_CONFIG: AIConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  temperature: 0.1,
  maxTokens: 8192,
  retryAttempts: 3,
};

export class AIProviderService {
  private groqService: GroqService | null = null;
  private openaiService: OpenAIService | null = null;
  private claudeService: ClaudeService | null = null;
  private cachedConfig: AIConfig | null = null;
  private configLastFetched: number = 0;
  private readonly CONFIG_CACHE_DURATION = 60 * 1000; // 1 minute cache

  constructor() {
    // Services are initialized lazily when needed
  }

  /**
   * Get AI configuration from database (with caching)
   */
  private async getConfig(): Promise<AIConfig> {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.cachedConfig && (now - this.configLastFetched) < this.CONFIG_CACHE_DURATION) {
      return this.cachedConfig;
    }

    try {
      const [settings] = await db.select({
        aiProvider: systemSettings.aiProvider,
        aiModel: systemSettings.aiModel,
        aiTemperature: systemSettings.aiTemperature,
        aiMaxTokens: systemSettings.aiMaxTokens,
        aiRetryAttempts: systemSettings.aiRetryAttempts,
      }).from(systemSettings).limit(1);

      if (settings) {
        this.cachedConfig = {
          provider: (settings.aiProvider as 'anthropic' | 'groq' | 'openai') || DEFAULT_CONFIG.provider,
          model: settings.aiModel || DEFAULT_CONFIG.model,
          temperature: settings.aiTemperature || DEFAULT_CONFIG.temperature,
          maxTokens: settings.aiMaxTokens || DEFAULT_CONFIG.maxTokens,
          retryAttempts: settings.aiRetryAttempts || DEFAULT_CONFIG.retryAttempts,
        };
      } else {
        this.cachedConfig = DEFAULT_CONFIG;
      }

      this.configLastFetched = now;
      console.log(`🤖 AI Provider Config: ${this.cachedConfig.provider} / ${this.cachedConfig.model}`);
      return this.cachedConfig;
    } catch (error) {
      console.warn('⚠️ Failed to load AI config from database, using defaults:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Get or create Claude service
   */
  private getClaudeService(config: AIConfig): ClaudeService {
    if (!this.claudeService) {
      this.claudeService = new ClaudeService(config.model, config.maxTokens, config.temperature);
    } else {
      // Update model if changed
      if (this.claudeService.getModel() !== config.model) {
        this.claudeService.setModel(config.model);
      }
    }
    return this.claudeService;
  }

  /**
   * Get or create Groq service
   */
  private getGroqService(): GroqService {
    if (!this.groqService) {
      this.groqService = new GroqService();
    }
    return this.groqService;
  }

  /**
   * Get or create OpenAI service
   */
  private getOpenAIService(): OpenAIService {
    if (!this.openaiService) {
      this.openaiService = new OpenAIService();
    }
    return this.openaiService;
  }

  /**
   * Analyze a contract
   */
  async analyzeContract(contractText: string): Promise<ContractAnalysisResult> {
    const config = await this.getConfig();
    
    console.log(`📄 Analyzing contract with ${config.provider}/${config.model}`);
    
    try {
      switch (config.provider) {
        case 'anthropic':
          return await this.getClaudeService(config).analyzeContract(contractText);
        
        case 'groq':
          return await this.getGroqService().analyzeContract(contractText);
        
        case 'openai':
          return await this.getOpenAIService().analyzeContract(contractText);
        
        default:
          console.warn(`⚠️ Unknown provider ${config.provider}, falling back to Claude`);
          return await this.getClaudeService(config).analyzeContract(contractText);
      }
    } catch (error: any) {
      console.error(`❌ ${config.provider} analyzeContract failed:`, error.message);
      
      // Fallback chain: Claude -> Groq -> OpenAI
      if (config.provider !== 'anthropic') {
        console.log('🔄 Falling back to Claude...');
        try {
          return await this.getClaudeService({ ...config, model: 'claude-sonnet-4-5' }).analyzeContract(contractText);
        } catch (claudeError) {
          console.error('❌ Claude fallback failed:', claudeError);
        }
      }
      
      if (config.provider !== 'groq') {
        console.log('🔄 Falling back to Groq...');
        try {
          return await this.getGroqService().analyzeContract(contractText);
        } catch (groqError) {
          console.error('❌ Groq fallback failed:', groqError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Extract detailed fee/license rules from contract
   */
  async extractDetailedContractRules(contractText: string, contractTypeCode?: string): Promise<LicenseRuleExtractionResult> {
    const config = await this.getConfig();
    
    // Pre-filter text to fee-relevant sections to reduce payload
    const relevantText = this.extractFeeRelevantSections(contractText);
    
    console.log(`📋 Extracting rules with ${config.provider}/${config.model}`);
    
    try {
      switch (config.provider) {
        case 'anthropic':
          return await this.getClaudeService(config).extractDetailedContractRules(relevantText, contractTypeCode);
        
        case 'groq':
          return await this.getGroqService().extractDetailedContractRules(relevantText, contractTypeCode);
        
        case 'openai':
          return await this.getOpenAIService().extractDetailedContractRules(relevantText);
        
        default:
          console.warn(`⚠️ Unknown provider ${config.provider}, falling back to Claude`);
          return await this.getClaudeService(config).extractDetailedContractRules(relevantText, contractTypeCode);
      }
    } catch (error: any) {
      console.error(`❌ ${config.provider} extractDetailedContractRules failed:`, error.message);
      
      // Fallback chain
      if (config.provider !== 'anthropic') {
        console.log('🔄 Falling back to Claude...');
        try {
          return await this.getClaudeService({ ...config, model: 'claude-sonnet-4-5' }).extractDetailedContractRules(relevantText, contractTypeCode);
        } catch (claudeError) {
          console.error('❌ Claude fallback failed:', claudeError);
        }
      }
      
      if (config.provider !== 'groq') {
        console.log('🔄 Falling back to Groq...');
        try {
          return await this.getGroqService().extractDetailedContractRules(relevantText, contractTypeCode);
        } catch (groqError) {
          console.error('❌ Groq fallback failed:', groqError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Pre-filter contract text to fee-relevant sections
   */
  private extractFeeRelevantSections(contractText: string): string {
    const feeKeywords = [
      'contract fee', 'royalties', 'tier', 'tier 1', 'tier 2', 'tier 3', 
      'per unit', 'per-unit', 'minimum', 'guarantee', 'payment', 'payments',
      'seasonal', 'spring', 'fall', 'holiday', 'premium', 'organic',
      'container', 'multiplier', 'schedule', 'exhibit', 'calculation',
      'territory', 'primary', 'secondary', 'volume', 'threshold',
      'contract fee', 'licence fee', 'rebate', 'commission', 'percentage',
      'rate', 'price', 'pricing', 'discount', 'net sales', 'gross sales'
    ];

    const lines = contractText.split('\n');
    const relevantLines: string[] = [];
    const contextWindow = 3;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      if (feeKeywords.some(keyword => line.includes(keyword))) {
        for (let j = Math.max(0, i - contextWindow); j < i; j++) {
          if (!relevantLines.includes(lines[j])) {
            relevantLines.push(lines[j]);
          }
        }
        
        if (!relevantLines.includes(lines[i])) {
          relevantLines.push(lines[i]);
        }
        
        for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextWindow); j++) {
          if (!relevantLines.includes(lines[j])) {
            relevantLines.push(lines[j]);
          }
        }
      }
    }

    const filteredText = relevantLines.join('\n');
    
    if (filteredText.length < 1000) {
      console.log(`📝 Filtered text too short (${filteredText.length}), using truncated original`);
      return contractText.substring(0, 80000);
    }
    
    console.log(`📝 Filtered text: ${filteredText.length} chars (from ${contractText.length})`);
    return filteredText;
  }

  /**
   * Get current AI provider status
   */
  async getStatus() {
    const config = await this.getConfig();
    return {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };
  }

  /**
   * Clear cached configuration (force reload)
   */
  clearConfigCache() {
    this.cachedConfig = null;
    this.configLastFetched = 0;
    console.log('🔄 AI Provider config cache cleared');
  }
}

// Export singleton instance
export const aiProviderService = new AIProviderService();
