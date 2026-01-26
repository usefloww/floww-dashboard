/**
 * Agent Context and Types
 *
 * Defines the context and message types for the agentic workflow builder.
 */

// ============================================================================
// Message Part Types (matching Python's MessagePart)
// ============================================================================

export type MessagePartType =
  | 'text'
  | 'data-question'
  | 'data-plan-confirmation'
  | 'data-code'
  | 'data-provider-setup'
  | 'data-secret-setup';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface QuestionData {
  question: string;
  options: QuestionOption[];
  allowMultiple?: boolean;
}

export interface PlanTrigger {
  type: string;
  source: string;
  details: string;
}

export interface PlanAction {
  provider: string;
  description: string;
}

export interface Plan {
  summary: string;
  trigger: PlanTrigger;
  actions: PlanAction[];
  requiredProviders: string[];
  requiredSecrets: string[];
}

export interface ProviderSetupData {
  provider: string;
  configured: boolean;
  setupUrl?: string;
}

export interface SecretSetupData {
  secretName: string;
  secretType: string;
  description?: string;
}

export interface CodeData {
  code: string;
  explanation?: string;
}

export interface MessagePart {
  type: MessagePartType;
  text?: string;
  data?: QuestionData | Plan | ProviderSetupData | SecretSetupData | CodeData | Record<string, unknown>;
}

// ============================================================================
// Agent Context
// ============================================================================

export interface ConfiguredProvider {
  name: string;
  type: string;
  configured: boolean;
}

export interface AgentContext {
  namespaceId: string;
  workflowId?: string;
  configuredProviders: ConfiguredProvider[];
  currentCode?: string;
  currentPlan?: Plan;
}

// ============================================================================
// Conversation Types
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================================================
// Agent Response
// ============================================================================

export interface AgentResponse {
  parts: MessagePart[];
  code?: string;
  plan?: Plan;
  isTerminal: boolean;
  terminalReason?: 'question' | 'plan' | 'code' | 'update' | 'text';
}

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolResult {
  isTerminal: boolean;
  parts: MessagePart[];
  code?: string;
  plan?: Plan;
}

// ============================================================================
// Available Providers (static list matching floww-sdk)
// ============================================================================

export const AVAILABLE_PROVIDERS = [
  { name: 'slack', displayName: 'Slack', capabilities: ['triggers', 'actions'] },
  { name: 'github', displayName: 'GitHub', capabilities: ['triggers', 'actions'] },
  { name: 'google', displayName: 'Google', capabilities: ['actions'] },
  { name: 'stripe', displayName: 'Stripe', capabilities: ['triggers', 'actions'] },
  { name: 'discord', displayName: 'Discord', capabilities: ['actions'] },
  { name: 'openai', displayName: 'OpenAI', capabilities: ['actions'] },
  { name: 'http', displayName: 'HTTP/Webhook', capabilities: ['triggers', 'actions'] },
] as const;

export type AvailableProviderName = (typeof AVAILABLE_PROVIDERS)[number]['name'];
