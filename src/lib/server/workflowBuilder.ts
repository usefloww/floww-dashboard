import { createServerFn } from '@tanstack/react-start';
import { requireUser } from './utils';

export interface MessagePart {
  type: string;
  text?: string;
  data?: {
    message?: string;
    question?: string;
    options?: Array<{ id: string; label: string; description?: string }>;
    provider_type?: string;
    code?: string;
    allow_multiple?: boolean;
    secret_name?: string;
  };
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface BuilderChatRequest {
  workflowId: string;
  messages: ChatMessage[];
  userMessage: string;
  currentCode: string;
  namespaceId?: string;
}

export interface BuilderChatResponse {
  message: {
    role: string;
    parts: MessagePart[];
  };
  code?: string;
}

/**
 * Send a chat message for AI-assisted workflow building
 */
export const builderChat = createServerFn({ method: 'POST' })
  .inputValidator((input: BuilderChatRequest) => input)
  .handler(async ({ data }): Promise<BuilderChatResponse> => {
    const user = await requireUser();
    const { hasWorkflowAccess } = await import('~/server/services/access-service');
    const { getWorkflow } = await import('~/server/services/workflow-service');
    const { generateWorkflow } = await import('~/server/packages/ai-generator');

    // Check access
    const hasAccess = await hasWorkflowAccess(user.id, data.workflowId);
    if (!hasAccess && !user.isAdmin) {
      throw new Error('Access denied');
    }

    // Get workflow to verify it exists
    const workflow = await getWorkflow(data.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    try {
      // Build the prompt from the conversation history and current message
      let prompt = data.userMessage;
      
      // Add context from previous messages if available
      if (data.messages.length > 0) {
        const conversationContext = data.messages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
        prompt = `Previous conversation:\n${conversationContext}\n\nCurrent request: ${prompt}`;
      }

      const result = await generateWorkflow({
        prompt,
        existingCode: data.currentCode || undefined,
        options: {
          temperature: 0.2,
        },
      });

      // Convert the result to the expected response format
      const parts: MessagePart[] = [];

      // Add explanation as text if available
      if (result.explanation) {
        parts.push({ type: 'text', text: result.explanation });
      }

      // Add the generated code
      if (result.code) {
        parts.push({
          type: 'data-code',
          data: { code: result.code },
        });
      }

      // Add provider suggestions if any
      if (result.suggestedProviders && result.suggestedProviders.length > 0) {
        for (const providerType of result.suggestedProviders) {
          parts.push({
            type: 'data-provider-setup',
            data: {
              message: `This workflow uses the ${providerType} provider. Make sure it's configured.`,
              provider_type: providerType,
            },
          });
        }
      }

      // Add secret suggestions if any
      if (result.suggestedSecrets && result.suggestedSecrets.length > 0) {
        for (const secretName of result.suggestedSecrets) {
          parts.push({
            type: 'data-secret-setup',
            data: {
              message: `This workflow needs the secret "${secretName}". Please configure it.`,
              secret_name: secretName,
            },
          });
        }
      }

      // Add a fallback text part if no parts were added
      if (parts.length === 0) {
        parts.push({ type: 'text', text: 'I generated the workflow code for you.' });
      }

      return {
        message: {
          role: 'assistant',
          parts,
        },
        code: result.code,
      };
    } catch (error) {
      // Return error as a message part
      const errorMessage = error instanceof Error ? error.message : 'AI generation failed';
      return {
        message: {
          role: 'assistant',
          parts: [
            {
              type: 'data-not-supported',
              data: { message: `Error: ${errorMessage}` },
            },
          ],
        },
      };
    }
  });
