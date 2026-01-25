/**
 * AI Generator Package
 *
 * Provides AI-assisted workflow generation using various LLM providers.
 */

import { settings } from '~/server/settings';

export interface GenerationRequest {
  prompt: string;
  existingCode?: string;
  context?: {
    providers?: string[];
    triggers?: string[];
    secrets?: string[];
  };
  options?: GenerationOptions;
}

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface GenerationResult {
  code: string;
  explanation?: string;
  suggestedName?: string;
  suggestedProviders?: string[];
  suggestedSecrets?: string[];
  confidence: number;
}

export interface StreamingChunk {
  type: 'code' | 'explanation' | 'metadata';
  content: string;
  done: boolean;
}

/**
 * AI Provider interface
 */
export interface AIProvider {
  name: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  generateStream?(
    request: GenerationRequest
  ): AsyncGenerator<StreamingChunk, void, unknown>;
}

/**
 * System prompt for workflow generation
 */
const SYSTEM_PROMPT = `You are an expert TypeScript developer specializing in automation workflows.
Your task is to generate workflow code using the Floww SDK.

Key patterns to follow:
1. Import from 'floww' for workflow primitives
2. Use async/await for all async operations
3. Handle errors gracefully with try/catch
4. Add JSDoc comments for complex logic
5. Use TypeScript types for parameters

Available trigger types:
- webhook: HTTP webhook triggers
- cron: Scheduled triggers
- manual: User-initiated triggers

Available provider integrations:
- slack: Slack messaging
- google: Google services (Sheets, Drive, Calendar)
- github: GitHub API
- stripe: Stripe payments
- custom: Custom HTTP integrations

Example workflow structure:
\`\`\`typescript
import { defineWorkflow, trigger, action } from 'floww';

export default defineWorkflow({
  name: 'My Workflow',
  triggers: [
    trigger.webhook({ path: '/my-hook' }),
  ],
  run: async (ctx) => {
    // Workflow logic here
    return { success: true };
  },
});
\`\`\`

Generate clean, production-ready code based on the user's request.`;

/**
 * OpenAI-based AI provider
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = settings.ai.OPENAI_API_KEY ?? '';
    this.baseUrl = settings.ai.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    this.defaultModel = settings.ai.AI_MODEL ?? 'gpt-4-turbo-preview';
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const userPrompt = this.buildUserPrompt(request);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.options?.model ?? this.defaultModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: request.options?.temperature ?? 0.2,
        max_tokens: request.options?.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    return this.parseResponse(content);
  }

  async *generateStream(
    request: GenerationRequest
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    const userPrompt = this.buildUserPrompt(request);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.options?.model ?? this.defaultModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: request.options?.temperature ?? 0.2,
        max_tokens: request.options?.maxTokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { type: 'code', content: '', done: true };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices[0]?.delta?.content ?? '';
            if (content) {
              yield { type: 'code', content, done: false };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  private buildUserPrompt(request: GenerationRequest): string {
    let prompt = request.prompt;

    if (request.existingCode) {
      prompt += `\n\nExisting code to modify:\n\`\`\`typescript\n${request.existingCode}\n\`\`\``;
    }

    if (request.context) {
      if (request.context.providers?.length) {
        prompt += `\n\nAvailable providers: ${request.context.providers.join(', ')}`;
      }
      if (request.context.triggers?.length) {
        prompt += `\nExisting triggers: ${request.context.triggers.join(', ')}`;
      }
      if (request.context.secrets?.length) {
        prompt += `\nAvailable secrets: ${request.context.secrets.join(', ')}`;
      }
    }

    return prompt;
  }

  private parseResponse(content: string): GenerationResult {
    // Extract code blocks
    const codeMatch = content.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : content.trim();

    // Extract explanation (text before/after code block)
    const explanation = content.replace(/```[\s\S]*?```/g, '').trim();

    // Try to extract workflow name from code
    const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/);
    const suggestedName = nameMatch ? nameMatch[1] : undefined;

    // Extract provider references
    const providers: string[] = [];
    if (code.includes('slack')) providers.push('slack');
    if (code.includes('google')) providers.push('google');
    if (code.includes('github')) providers.push('github');
    if (code.includes('stripe')) providers.push('stripe');

    return {
      code,
      explanation: explanation || undefined,
      suggestedName,
      suggestedProviders: providers.length > 0 ? providers : undefined,
      confidence: 0.85, // Default confidence
    };
  }
}

/**
 * Anthropic Claude provider
 */
export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = settings.ai.ANTHROPIC_API_KEY ?? '';
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.defaultModel = settings.ai.AI_MODEL ?? 'claude-3-sonnet-20240229';
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const userPrompt = this.buildUserPrompt(request);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.options?.model ?? this.defaultModel,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: request.options?.maxTokens ?? 2000,
        temperature: request.options?.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    return this.parseResponse(content);
  }

  private buildUserPrompt(request: GenerationRequest): string {
    let prompt = request.prompt;

    if (request.existingCode) {
      prompt += `\n\nExisting code to modify:\n\`\`\`typescript\n${request.existingCode}\n\`\`\``;
    }

    return prompt;
  }

  private parseResponse(content: string): GenerationResult {
    const codeMatch = content.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : content.trim();
    const explanation = content.replace(/```[\s\S]*?```/g, '').trim();

    return {
      code,
      explanation: explanation || undefined,
      confidence: 0.85,
    };
  }
}

/**
 * Get the configured AI provider
 */
export function getAIProvider(): AIProvider {
  const providerType = settings.ai.AI_PROVIDER ?? 'openai';

  switch (providerType) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown AI provider: ${providerType}`);
  }
}

/**
 * Generate workflow code using the configured AI provider
 */
export async function generateWorkflow(
  request: GenerationRequest
): Promise<GenerationResult> {
  const provider = getAIProvider();
  return provider.generate(request);
}

/**
 * Generate workflow code with streaming using the configured AI provider
 */
export async function* generateWorkflowStream(
  request: GenerationRequest
): AsyncGenerator<StreamingChunk, void, unknown> {
  const provider = getAIProvider();
  if (provider.generateStream) {
    yield* provider.generateStream(request);
  } else {
    const result = await provider.generate(request);
    yield { type: 'code', content: result.code, done: true };
  }
}
