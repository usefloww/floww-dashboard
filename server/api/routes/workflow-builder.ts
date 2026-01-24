/**
 * Workflow Builder Routes
 *
 * POST /workflows/:id/builder/chat - AI chat endpoint for workflow generation
 */

import { post, json, errorResponse, parseBody } from '~/server/api/router';
import { hasWorkflowAccess } from '~/server/services/access-service';
import { getWorkflow } from '~/server/services/workflow-service';
import { generateWorkflow, generateWorkflowStream } from '~/server/packages/ai-generator';
import { workflowBuilderChatSchema } from '~/server/api/schemas';

// AI chat endpoint for workflow generation
post('/workflows/:workflowId/builder/chat', async ({ user, params, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { workflowId } = params;

  // Check access
  const hasAccess = await hasWorkflowAccess(user.id, workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Get workflow
  const workflow = await getWorkflow(workflowId);
  if (!workflow) {
    return errorResponse('Workflow not found', 404);
  }

  const parsed = await parseBody(request, workflowBuilderChatSchema);
  if ('error' in parsed) return parsed.error;

  const { message, context, options } = parsed.data;

  // Check if streaming is requested
  const shouldStream = options?.stream ?? false;

  if (shouldStream) {
    // Return streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = generateWorkflowStream({
            prompt: message,
            existingCode: context?.existingCode,
            context: {
              providers: context?.providers,
              triggers: context?.triggers,
              secrets: context?.secrets,
            },
            options: {
              model: options?.model,
              temperature: options?.temperature,
              stream: true,
            },
          });

          for await (const chunk of generator) {
            const data = JSON.stringify(chunk) + '\n';
            controller.enqueue(new TextEncoder().encode(data));
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // Non-streaming response
  try {
    const result = await generateWorkflow({
      prompt: message,
      existingCode: context?.existingCode,
      context: {
        providers: context?.providers,
        triggers: context?.triggers,
        secrets: context?.secrets,
      },
      options: {
        model: options?.model,
        temperature: options?.temperature,
      },
    });

    return json({
      code: result.code,
      explanation: result.explanation,
      suggestedName: result.suggestedName,
      suggestedProviders: result.suggestedProviders,
      suggestedSecrets: result.suggestedSecrets,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('AI generation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'AI generation failed',
      500
    );
  }
});
