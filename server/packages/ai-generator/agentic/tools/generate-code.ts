/**
 * Generate Workflow Code Tool
 *
 * Generates the final TypeScript workflow code after plan approval.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { MessagePart, SecretSetupData, CodeData } from '../context';

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
  // Remove markdown code fences
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

export function createGenerateCodeTool() {
  return tool({
    description:
      'Generate the final TypeScript workflow code. ' +
      'Only use this tool AFTER the user has approved the plan. ' +
      'The code should be complete and production-ready. ' +
      'This is a terminal tool - code generation completes the workflow building process.',
    inputSchema: z.object({
      code: z.string().describe('The complete TypeScript workflow code'),
      explanation: z.string().describe('Brief explanation of what the code does'),
    }),
    execute: async ({ code, explanation }) => {
      const cleanedCode = cleanCode(code);
      const secrets = extractSecrets(cleanedCode);

      const parts: MessagePart[] = [];

      // Add explanation as text
      parts.push({
        type: 'text',
        text: explanation,
      });

      // Add code data
      const codeData: CodeData = {
        code: cleanedCode,
        explanation,
      };
      parts.push({
        type: 'data-code',
        data: codeData,
      });

      // Add secret setup prompts for each detected secret
      for (const secretName of secrets) {
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
