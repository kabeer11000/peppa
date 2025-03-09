import { DeepSeekClient } from './deepseek-client';

export type AIProvider = 'deepseek' | 'openai' | 'anthropic' | 'gemini';

export interface AIModelOptions {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIModel {
  generateCompletion(messages: Message[]): Promise<string>;
  streamCompletion(
    messages: Message[],
    onToken: (token: string) => void,
    onComplete: (fullText: string) => void
  ): Promise<void>;
}

/**
 * Factory function to create an AI model client based on provider
 */
export function createAIModel(options: AIModelOptions): AIModel {
  switch (options.provider) {
    case 'deepseek':
      return new DeepSeekClient({
        model: options.model || 'deepseek-coder',
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt,
      });
    
    // Add support for more providers here in the future
    // case 'openai':
    //   return new OpenAIClient(options);
    
    // case 'anthropic':
    //   return new AnthropicClient(options);
    
    // case 'gemini':
    //   return new GeminiClient(options);
    
    default:
      throw new Error(`AI provider not supported: ${options.provider}`);
  }
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider: AIProvider): { id: string; name: string }[] {
  switch (provider) {
    case 'deepseek':
      return [
        { id: 'deepseek-coder', name: 'DeepSeek Coder' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'deepseek-llm-7b', name: 'DeepSeek LLM 7B' },
      ];
    
    // Add more providers here
    // case 'openai':
    //   return [...];
    
    default:
      return [];
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): { id: AIProvider; name: string }[] {
  return [
    { id: 'deepseek', name: 'DeepSeek AI' },
    // Add more providers as they are implemented
    // { id: 'openai', name: 'OpenAI' },
    // { id: 'anthropic', name: 'Anthropic' },
    // { id: 'gemini', name: 'Google Gemini' },
  ];
} 