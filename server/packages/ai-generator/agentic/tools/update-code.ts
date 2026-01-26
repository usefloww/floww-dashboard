/**
 * Update Workflow Code Tool
 *
 * Updates existing workflow code based on user feedback.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { MessagePart, SecretSetupData, CodeData, AgentContext } from '../context';

/**
 * Extract Secret<...> patterns from generated code
 */
function extractSecrets(code: string): string[] {
  const secretPattern = /Secret<['"]([^'"]+)['"]>/g;
  const secrets: string[] = [];
  let match;

  while ((match = secretPattern.exec(code)) !== null) {
    if (!secrets.includes(match[1])) {
      secrets.push(match[1]);
    }
  }

  return secrets;
}

/**
 * Clean markdown code fences from generated code
 */
function cleanCode(code: string): string {
  let cleaned = code.replace(/^```(?:typescript|ts)?\n?/gm, '');
  cleaned = cleaned.replace(/\n?```$/gm, '');
  return cleaned.trim();
}

/**
 * Infer secret type from secret name
 */
function inferSecretType(secretName: string): string {
  const name = secretName.toLowerCase();

  if (name.includes('api_key') || name.includes('apikey')) {
    return 'api_key';
  }
  if (name.includes('token')) {
    return 'token';
  }
  if (name.includes('secret')) {
    return 'secret';
  }
  if (name.includes('password')) {
    return 'password';
  }
  if (name.includes('webhook')) {
    return 'webhook_url';
  }

  return 'credential';
}

export function createUpdateCodeTool(context: AgentContext) {
  return tool({
    description:
      'Update existing workflow code based on user feedback or requests. ' +
      'Use this when the user wants to modify an existing workflow. ' +
      'This is a terminal tool - the update completes the current request.',
    inputSchema: z.object({
      code: z.string().describe('The complete updated TypeScript workflow code'),
      changesMade: z.string().describe('Summary of the changes made to the code'),
    }),
    execute: async ({ code, changesMade }) => {
      const cleanedCode = cleanCode(code);
      const newSecrets = extractSecrets(cleanedCode);

      // Find secrets that weren't in the original code
      const oldSecrets = context.currentCode ? extractSecrets(context.currentCode) : [];
      const addedSecrets = newSecrets.filter((s) => !oldSecrets.includes(s));

      const parts: MessagePart[] = [];

      // Add changes explanation
      parts.push({
        type: 'text',
        text: changesMade,
      });

      // Add code data
      const codeData: CodeData = {
        code: cleanedCode,
        explanation: changesMade,
      };
      parts.push({
        type: 'data-code',
        data: codeData,
      });

      // Add secret setup prompts for new secrets only
      for (const secretName of addedSecrets) {
        const secretData: SecretSetupData = {
          secretName,
          secretType: inferSecretType(secretName),
          description: `API key or credential for ${secretName}`,
        };
        parts.push({
          type: 'data-secret-setup',
          data: secretData,
        });
      }

      return {
        isTerminal: true,
        parts,
        code: cleanedCode,
      };
    },
  });
}
