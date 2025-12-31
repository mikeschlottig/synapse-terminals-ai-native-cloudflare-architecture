export type AgentType = 'coder' | 'reviewer' | 'security' | 'system';
export type TerminalStatus = 'online' | 'offline' | 'connecting' | 'error' | 'syncing';
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
  status: TerminalStatus;
  cwd: string;
  isSystemNode?: boolean;
  lastActive?: string;
}
export interface MeshNode {
  id: string;
  name: string;
  type: AgentType;
  createdAt: string;
}
export interface InterNodeMessage {
  from: string;
  to: string;
  type: 'command' | 'status' | 'data';
  payload: {
    command?: string;
    data?: any;
  };
}
export interface MeshStats {
  totalNodes: number;
  activeConnections: number;
  avgLatency: number;
  systemHealth: number;
  messageCount?: number;
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