import { DurableObject } from "cloudflare:workers";
import type { TerminalConfig, AgentType, FileSystemItem, ExecuteRequest, ExecuteResponse, MeshNode, ChatMessage } from '@shared/types';
import { Env } from "./core-utils";
interface AIEnv {
  run(model: string, options: { messages: ChatMessage[] }): Promise<{ response: string }>;
}
export class GlobalDurableObject extends DurableObject<Env> {
    private sessions: Set<WebSocket> = new Set();
    private config: TerminalConfig | null = null;
    private history: ChatMessage[] = [];
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }
    private async ensureConfig(): Promise<TerminalConfig> {
        if (this.config) return this.config;
        const stored = await this.ctx.storage.get<TerminalConfig>("config");
        if (stored) {
            this.config = stored;
            return stored;
        }
        const defaultConfig: TerminalConfig = {
            id: this.ctx.id.toString(),
            name: "Agent-" + this.ctx.id.toString().slice(0, 4),
            agentType: 'system',
            systemPrompt: "You are a specialized Synapse terminal node. Use only terminal commands like ls, touch, echo. If asked questions, answer like a hacker/sysadmin.",
            status: 'online',
            cwd: '/',
            isSystemNode: false,
            lastActive: new Date().toISOString()
        };
        const rootFS: FileSystemItem = {
            name: '/',
            type: 'dir',
            children: [
                { name: 'logs', type: 'dir', children: [] },
                { name: 'manifest.json', type: 'file', content: '{"version": "1.4.2", "status": "stable"}' }
            ]
        };
        await this.ctx.storage.put("fs_root", rootFS);
        await this.ctx.storage.put("config", defaultConfig);
        this.config = defaultConfig;
        return defaultConfig;
    }
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/api/mesh/nodes') {
            const nodes = await this.ctx.storage.get<MeshNode[]>("mesh_nodes") || [];
            return Response.json({ success: true, data: nodes });
        }
        if (url.pathname === '/api/mesh/register' && request.method === 'POST') {
            const newNode = await request.json() as MeshNode;
            const nodes = await this.ctx.storage.get<MeshNode[]>("mesh_nodes") || [];
            if (!nodes.find(n => n.id === newNode.id)) {
                nodes.push({ ...newNode, createdAt: new Date().toISOString() });
                await this.ctx.storage.put("mesh_nodes", nodes);
            }
            return Response.json({ success: true, data: nodes });
        }
        if (url.pathname.endsWith('/execute') && request.method === 'POST') {
          const req = await request.json() as ExecuteRequest;
          const config = await this.ensureConfig();
          this.broadcast(`\r\n\x1b[35m[RELAY_START]\x1b[0m Received instruction from ${req.callerName}\r\n`);
          const result = await this.internalExecute(req.prompt, req.context);
          this.broadcast(`\r\n\x1b[35m[RELAY_END]\x1b[0m Task complete.\r\n\x1b[32muser@synapse:${config.cwd}$ \x1b[0m`);
          return Response.json({ success: true, data: { text: result } } satisfies ApiResponse<ExecuteResponse>);
        }
        if (url.pathname.includes('/connect')) {
            const pair = new WebSocketPair();
            await this.handleWebSocket(pair[1]);
            return new Response(null, { status: 101, webSocket: pair[0] });
        }
        if (url.pathname.includes('/config')) {
            if (request.method === 'GET') {
                const config = await this.ensureConfig();
                return Response.json({ success: true, data: config });
            }
            if (request.method === 'PUT') {
                const updates = await request.json() as Partial<TerminalConfig>;
                const current = await this.ensureConfig();
                const updated = { ...current, ...updates, lastActive: new Date().toISOString() };
                await this.ctx.storage.put("config", updated);
                this.config = updated;
                this.broadcast(`\r\n\x1b[35m[SYSTEM] Neural Re-Sync: ${updated.agentType.toUpperCase()} persona engaged.\x1b[0m\r\n\x1b[32muser@synapse:${updated.cwd}$ \x1b[0m`);
                return Response.json({ success: true, data: updated });
            }
        }
        return new Response('Not Found', { status: 404 });
    }
    private broadcast(message: string) {
        for (const ws of this.sessions) {
            try { ws.send(message); } catch (e) { this.sessions.delete(ws); }
        }
    }
    private async handleWebSocket(ws: WebSocket) {
        ws.accept();
        this.sessions.add(ws);
        const config = await this.ensureConfig();
        ws.send(`\x1b[1;36m>> INITIATING NEURAL UPLINK...\x1b[0m\r\n`);
        ws.send(`\x1b[33m[SYNAPSE]\x1b[0m Node: ${config.name} (${config.agentType}) online.\r\n`);
        ws.send(`\x1b[32muser@synapse:${config.cwd}$ \x1b[0m`);
        let buffer = '';
        ws.addEventListener('message', async (event) => {
            const data = event.data as string;
            if (data === '\r') {
                const command = buffer.trim();
                ws.send('\r\n');
                if (command) {
                    await this.processCommand(ws, command);
                }
                const updated = await this.ensureConfig();
                ws.send(`\x1b[32muser@synapse:${updated.cwd}$ \x1b[0m`);
                buffer = '';
            } else if (data === '\u007f') {
                if (buffer.length > 0) {
                    buffer = buffer.slice(0, -1);
                    ws.send('\b \b');
                }
            } else {
                buffer += data;
                ws.send(data);
            }
        });
        ws.addEventListener('close', () => this.sessions.delete(ws));
    }
    private async processCommand(ws: WebSocket, command: string) {
        if (command.startsWith('@')) {
          await this.handleInterNodeCall(ws, command);
          return;
        }
        const builtins = ['ls', 'cd', 'mkdir', 'touch', 'rm', 'cat', 'whoami', 'help', 'clear'];
        const cmd = command.split(' ')[0];
        if (builtins.includes(cmd)) {
            await this.handleBuiltin(ws, command);
            return;
        }
        await this.handleAICommand(ws, command);
    }
    private async handleInterNodeCall(ws: WebSocket, command: string) {
      const match = command.match(/^@(\S+)\s+(.*)$/);
      if (!match) {
        ws.send(`\x1b[31m[ERROR] Invalid relay syntax. Use @agent message.\x1b[0m\r\n`);
        return;
      }
      const targetName = match[1];
      const message = match[2];
      const globalStub = this.env.GlobalDurableObject.get(this.env.GlobalDurableObject.idFromName("global"));
      const res = await globalStub.fetch("http://global/api/mesh/nodes");
      const nodesResult = await res.json() as ApiResponse<MeshNode[]>;
      const target = nodesResult.data?.find(n => n.name.toLowerCase() === targetName.toLowerCase() || n.id === targetName);
      if (!target) {
        ws.send(`\x1b[31m[ERROR] Node '${targetName}' not found in registry.\x1b[0m\r\n`);
        return;
      }
      ws.send(`\x1b[35m[RELAY] Contacting ${target.name}...\x1b[0m\r\n`);
      const targetStub = this.env.GlobalDurableObject.get(this.env.GlobalDurableObject.idFromName(target.id));
      const config = await this.ensureConfig();
      const root = await this.ctx.storage.get<FileSystemItem>("fs_root") || { name: '/', type: 'dir', children: [] };
      try {
        const relayRes = await targetStub.fetch(`http://node/api/terminal/${target.id}/execute`, {
          method: 'POST',
          body: JSON.stringify({
            prompt: message,
            callerId: config.id,
            callerName: config.name,
            context: {
              cwd: config.cwd,
              fsSummary: root.children?.map(c => c.name).join(', ') || 'none',
              history: this.history
            }
          } satisfies ExecuteRequest)
        });
        const relayData = await relayRes.json() as ApiResponse<ExecuteResponse>;
        ws.send(`\x1b[36m[RELAY_RESPONSE from ${target.name}]\x1b[0m\r\n${relayData.data?.text}\r\n`);
      } catch (e) {
        ws.send(`\x1b[31m[ERROR] Relay failed: Target node unreachable.\x1b[0m\r\n`);
      }
    }
    private async handleAICommand(ws: WebSocket, command: string) {
        const config = await this.ensureConfig();
        const root = await this.ctx.storage.get<FileSystemItem>("fs_root") || { name: '/', type: 'dir', children: [] };
        ws.send(`\x1b[90m>> RELAYING TO NEURAL CORE...\x1b[0m\r\n`);
        const result = await this.internalExecute(command, {
          cwd: config.cwd,
          fsSummary: root.children?.map(c => c.name).join(', ') || 'none',
          history: this.history
        });
        ws.send(`\x1b[36m[NODE_RESPONSE]\x1b[0m ${result}\r\n`);
    }
    private async internalExecute(command: string, context: { cwd: string; fsSummary: string; history: ChatMessage[] }): Promise<string> {
      const config = await this.ensureConfig();
      const aiMessages: ChatMessage[] = [
          {
              role: 'system',
              content: `${config.systemPrompt}\n\nEnvironment context:\n- CWD: ${context.cwd}\n- FS: [${context.fsSummary}]\n- Role: ${config.agentType}\n\nRules: Be concise. If you need specialized help, suggest using @agent command.`
          },
          ...context.history.slice(-4),
          { role: 'user', content: command }
      ];
      try {
          const ai = (this.env as any).AI as AIEnv;
          if (!ai) return "[ERROR] AI Core unavailable.";
          const result = await ai.run('@cf/meta/llama-3-8b-instruct', { messages: aiMessages });
          this.history.push({ role: 'user', content: command });
          this.history.push({ role: 'assistant', content: result.response });
          if (this.history.length > 20) this.history = this.history.slice(-20);
          return result.response;
      } catch (e) {
          return "[ERROR] Neural saturation detected.";
      }
    }
    private async handleBuiltin(ws: WebSocket, command: string) {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        const root = await this.ctx.storage.get<FileSystemItem>("fs_root") || { name: '/', type: 'dir', children: [] };
        const config = await this.ensureConfig();
        switch (cmd) {
            case 'ls': {
                const out = root.children?.map(i => i.type === 'dir' ? `\x1b[1;34m${i.name}/\x1b[0m` : i.name).join('  ');
                ws.send(`${out || 'empty'}\r\n`);
                break;
            }
            case 'whoami':
                ws.send(`NODE: ${config.name}\r\nPERSONA: ${config.agentType}\r\n`);
                break;
            case 'clear':
                ws.send('\x1b[2J\x1b[H');
                break;
            case 'help':
                ws.send(`Commands: ls, whoami, clear, help, @[agent] [msg]\r\n`);
                break;
            default:
                ws.send(`Unknown builtin: ${cmd}\r\n`);
        }
    }
}