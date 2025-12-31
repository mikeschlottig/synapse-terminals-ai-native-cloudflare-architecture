export type AgentType = 'coder' | 'reviewer' | 'security' | 'system';
export interface TerminalConfig {
  id: string;
  name: string;
  agentType: AgentType;
  systemPrompt: string;
  status: 'online' | 'offline';
}
export interface ExecutionRequest {
  prompt: string;
  context?: Record<string, unknown>;
  callerId: string;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface DemoItem {
  id: string;
  name: string;
  value: number;
}