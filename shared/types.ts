export type AgentType = 'coder' | 'reviewer' | 'security' | 'system';
export interface FileSystemItem {
  name: string;
  type: 'file' | 'dir';
  content?: string;
  children?: FileSystemItem[];
}
export interface TerminalConfig {
  id: string;
  name: string;
  agentType: AgentType;
  systemPrompt: string;
  status: 'online' | 'offline';
  cwd: string;
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