import OpenAI from 'openai';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export class DeepSeekClient {
  private options: DeepSeekOptions;

  constructor(options: DeepSeekOptions) {
    this.options = {
      model: options.model || 'deepseek-coder',
      maxTokens: options.maxTokens || 2048,
      temperature: options.temperature || 0.7,
      systemPrompt: options.systemPrompt || '',
    };
  }

  async generateCompletion(messages: Message[]): Promise<string> {
    try {
      // Add system prompt if provided
      const allMessages = this.options.systemPrompt 
        ? [{ role: 'system' as const, content: this.options.systemPrompt }, ...messages] 
        : messages;

      const response = await fetch('/api/ai/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          model: this.options.model,
          maxTokens: this.options.maxTokens,
          temperature: this.options.temperature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.content || '';
    } catch (error) {
      console.error('Error generating completion from DeepSeek:', error);
      throw error;
    }
  }

  async streamCompletion(
    messages: Message[],
    onToken: (token: string) => void,
    onComplete: (fullText: string) => void
  ): Promise<void> {
    try {
      // Add system prompt if provided
      const allMessages = this.options.systemPrompt 
        ? [{ role: 'system' as const, content: this.options.systemPrompt }, ...messages] 
        : messages;

      const response = await fetch('/api/ai/deepseek-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          model: this.options.model,
          maxTokens: this.options.maxTokens,
          temperature: this.options.temperature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.error || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the stream chunk
        const chunk = decoder.decode(value, { stream: true });
        
        // Process each SSE event line
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.replace('data: ', '');
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullText += parsed.content;
                onToken(parsed.content);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Skip invalid JSON
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      onComplete(fullText);
    } catch (error) {
      console.error('Error streaming completion from DeepSeek:', error);
      throw error;
    }
  }
} 