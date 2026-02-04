/**
 * Agent Loop Implementation
 *
 * Implements the agentic workflow builder using Vercel AI SDK.
 */

import { generateText, stepCountIs, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { settings } from '~/server/settings';
import type { AgentContext, AgentResponse, ConversationMessage, MessagePart, Plan, ToolResult } from './context';
import { buildSystemPrompt, buildCodeGenerationPrompt, isPlanApproval } from './system-prompt';
import {
  createAskQuestionTool,
  createCheckProvidersTool,
  createSubmitPlanTool,
  createGenerateCodeTool,
  createUpdateCodeTool,
} from './tools';

const MAX_ITERATIONS = 10;

/**
 * Create the OpenRouter provider instance
 */
function createOpenRouterProvider() {
  const apiKey = settings.ai.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    headers: {
      'HTTP-Referer': settings.general.PUBLIC_API_URL || 'https://floww.dev',
      'X-Title': 'Floww Workflow Builder',
    },
  });
}

/**
 * Get the model name (strip openrouter/ prefix if present)
 */
function getModelName(): string {
  return settings.ai.AI_MODEL_CODEGEN.replace(/^openrouter\//, '');
}

/**
 * Convert conversation messages to AI SDK format
 */
function convertToAIMessages(messages: ConversationMessage[]): CoreMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Process a user message through the agent loop
 */
export async function processMessage(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  context: AgentContext
): Promise<AgentResponse> {
  const openrouter = createOpenRouterProvider();
  const modelName = getModelName();

  // Check for plan approval shortcut
  if (context.currentPlan && isPlanApproval(userMessage)) {
    return await generateCodeFromPlan(context.currentPlan, context, openrouter, modelName);
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(context);

  // Create context-aware tools
  const tools = {
    ask_clarifying_question: createAskQuestionTool(),
    check_providers: createCheckProvidersTool(context),
    submit_plan: createSubmitPlanTool(),
    generate_workflow_code: createGenerateCodeTool(),
    update_workflow_code: createUpdateCodeTool(context),
  };

  // Convert conversation history to AI SDK format
  const messages: CoreMessage[] = [
    ...convertToAIMessages(conversationHistory),
    { role: 'user', content: userMessage },
  ];

  // Track terminal state and collected parts
  let isTerminal = false;
  let terminalReason: AgentResponse['terminalReason'];
  const collectedParts: MessagePart[] = [];
  let generatedCode: string | undefined;
  let generatedPlan: Plan | undefined;

  try {
    // Run the agent loop with stopWhen
    const result = await generateText({
      model: openrouter(modelName),
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(MAX_ITERATIONS),
      onStepFinish: ({ toolCalls, toolResults }) => {
        // Process tool results to collect parts and detect terminal state
        if (toolResults && toolResults.length > 0) {
          for (let i = 0; i < toolResults.length; i++) {
            const toolResult = toolResults[i];
            // The output is the ToolResult we return from execute
            const output = toolResult.output as ToolResult | undefined;
            if (output) {
              collectedParts.push(...output.parts);

              if (output.code) {
                generatedCode = output.code;
              }
              if (output.plan) {
                generatedPlan = output.plan;
              }

              if (output.isTerminal) {
                isTerminal = true;

                // Determine terminal reason from tool name
                if (toolCalls && toolCalls[i]) {
                  const toolName = toolCalls[i].toolName;
                  if (toolName === 'ask_clarifying_question') {
                    terminalReason = 'question';
                  } else if (toolName === 'submit_plan') {
                    terminalReason = 'plan';
                  } else if (toolName === 'generate_workflow_code') {
                    terminalReason = 'code';
                  } else if (toolName === 'update_workflow_code') {
                    terminalReason = 'update';
                  }
                }
              }
            }
          }
        }
      },
    });

    // If no tool was called, add the text response
    if (collectedParts.length === 0 && result.text) {
      collectedParts.push({
        type: 'text',
        text: result.text,
      });
      isTerminal = true;
      terminalReason = 'text';
    }

    return {
      parts: collectedParts,
      code: generatedCode,
      plan: generatedPlan,
      isTerminal,
      terminalReason,
    };
  } catch (error) {
    console.error('Agent loop error:', error);

    return {
      parts: [
        {
          type: 'text',
          text: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isTerminal: true,
      terminalReason: 'text',
    };
  }
}

/**
 * Generate code directly from an approved plan (shortcut path)
 */
async function generateCodeFromPlan(
  plan: Plan,
  context: AgentContext,
  openrouter: ReturnType<typeof createOpenAI>,
  modelName: string
): Promise<AgentResponse> {
  const systemPrompt = buildSystemPrompt(context);
  const codeGenPrompt = buildCodeGenerationPrompt(plan, context);

  const tools = {
    generate_workflow_code: createGenerateCodeTool(),
    update_workflow_code: createUpdateCodeTool(context),
  };

  const collectedParts: MessagePart[] = [];
  let generatedCode: string | undefined;

  try {
    await generateText({
      model: openrouter(modelName),
      system: systemPrompt,
      messages: [{ role: 'user', content: codeGenPrompt }],
      tools,
      stopWhen: stepCountIs(3),
      onStepFinish: ({ toolResults }) => {
        if (toolResults && toolResults.length > 0) {
          for (const toolResult of toolResults) {
            const output = toolResult.output as ToolResult | undefined;
            if (output) {
              collectedParts.push(...output.parts);
              if (output.code) {
                generatedCode = output.code;
              }
            }
          }
        }
      },
    });

    return {
      parts: collectedParts,
      code: generatedCode,
      isTerminal: true,
      terminalReason: 'code',
    };
  } catch (error) {
    console.error('Code generation error:', error);

    return {
      parts: [
        {
          type: 'text',
          text: `I encountered an error while generating code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isTerminal: true,
      terminalReason: 'text',
    };
  }
}
