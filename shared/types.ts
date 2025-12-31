export type AgentType = 'coder' | 'reviewer' | 'security' | 'system';
export type TerminalStatus = 'online' | 'offline' | 'connecting' | 'error' | 'syncing' | 'processing';
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
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
  temperature?: number;
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