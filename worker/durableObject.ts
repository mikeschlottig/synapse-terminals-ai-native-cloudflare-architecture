import { DurableObject } from "cloudflare:workers";
import type { TerminalConfig, AgentType, FileSystemItem, InterNodeMessage, MeshNode, ChatMessage } from '@shared/types';
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
                { name: 'manifest.json', type: 'file', content: '{"version": "1.4.2", "status": "stable"}' },
                { name: 'README.md', type: 'file', content: '# Synapse Terminal\nWelcome to the mesh node.' }
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
        const bootSequence = [
            `\x1b[1;36m>> INITIATING NEURAL UPLINK...\x1b[0m`,
            `\x1b[90m[OK] Neural Engine: @cf/meta/llama-3-8b-instruct engaged\x1b[0m`,
            `\x1b[90m[OK] CWD: ${config.cwd} mounted\x1b[0m`,
            `\r\n\x1b[33m[SYNAPSE]\x1b[0m Node: ${config.name} (${config.agentType}) online.\r\n`
        ];
        for (const line of bootSequence) {
            ws.send(line + '\r\n');
            await new Promise(r => setTimeout(r, 100));
        }
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
                ws.send(`\r\n\x1b[32muser@synapse:${updated.cwd}$ \x1b[0m`);
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
        const builtins = ['ls', 'cd', 'mkdir', 'touch', 'rm', 'cat', 'whoami', 'help', 'clear'];
        const cmd = command.split(' ')[0];
        if (builtins.includes(cmd)) {
            await this.handleBuiltin(ws, command);
            return;
        }
        // Fallback to Workers AI for non-builtin or natural language
        await this.handleAICommand(ws, command);
    }
    private async handleAICommand(ws: WebSocket, command: string) {
        const config = await this.ensureConfig();
        const root = await this.ctx.storage.get<FileSystemItem>("fs_root") || { name: '/', type: 'dir', children: [] };
        ws.send(`\x1b[90m>> RELAYING TO NEURAL CORE...\x1b[0m\r\n`);
        const fsSummary = root.children?.map(c => `${c.name} (${c.type})`).join(', ') || 'empty';
        const aiMessages: ChatMessage[] = [
            { 
                role: 'system', 
                content: `${config.systemPrompt}\n\nEnvironment context:\n- CWD: ${config.cwd}\n- FS: [${fsSummary}]\n- Role: ${config.agentType}\n\nRules: If you want to modify files, use tags like [[touch filename]] or [[echo "text" > file]]. Keep responses concise.` 
            },
            ...this.history.slice(-4),
            { role: 'user', content: command }
        ];
        try {
            // Check if AI binding exists on env
            const ai = (this.env as any).AI as AIEnv;
            if (!ai) {
                ws.send(`\x1b[31m[ERROR] AI Core unavailable. Use 'help' for builtins.\x1b[0m\r\n`);
                return;
            }
            const result = await ai.run('@cf/meta/llama-3-8b-instruct', { messages: aiMessages });
            const response = result.response;
            // Update history
            this.history.push({ role: 'user', content: command });
            this.history.push({ role: 'assistant', content: response });
            if (this.history.length > 10) this.history = this.history.slice(-10);
            // Handle AI Tool Calls (Syntactic Sugar)
            const toolRegex = /\[\[(.*?)\]\]/g;
            let match;
            let finalOutput = response;
            while ((match = toolRegex.exec(response)) !== null) {
                const toolCmd = match[1].trim();
                ws.send(`\x1b[35m[AI_EXEC]\x1b[0m ${toolCmd}\r\n`);
                await this.handleBuiltin(ws, toolCmd, true);
                finalOutput = finalOutput.replace(match[0], '');
            }
            ws.send(`\x1b[36m[NODE_RESPONSE]\x1b[0m ${finalOutput.trim()}\r\n`);
        } catch (e) {
            console.error('AI Processing Error:', e);
            ws.send(`\x1b[31m[ERROR] Neural saturation detected. Response failed.\x1b[0m\r\n`);
        }
    }
    private async handleBuiltin(ws: WebSocket, command: string, silent = false) {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        const root = await this.ctx.storage.get<FileSystemItem>("fs_root") || { name: '/', type: 'dir', children: [] };
        const config = await this.ensureConfig();
        switch (cmd) {
            case 'ls':
                const out = root.children?.map(i => i.type === 'dir' ? `\x1b[1;34m${i.name}/\x1b[0m` : i.name).join('  ');
                ws.send(`${out || 'empty'}\r\n`);
                break;
            case 'mkdir':
                if (args[0]) {
                    root.children?.push({ name: args[0], type: 'dir', children: [] });
                    await this.ctx.storage.put("fs_root", root);
                    if (!silent) ws.send(`Created directory: ${args[0]}\r\n`);
                }
                break;
            case 'touch':
                if (args[0]) {
                    root.children?.push({ name: args[0], type: 'file', content: '' });
                    await this.ctx.storage.put("fs_root", root);
                    if (!silent) ws.send(`Created file: ${args[0]}\r\n`);
                }
                break;
            case 'rm':
                const idx = root.children?.findIndex(f => f.name === args[0]) ?? -1;
                if (idx > -1) {
                    root.children?.splice(idx, 1);
                    await this.ctx.storage.put("fs_root", root);
                    if (!silent) ws.send(`Removed ${args[0]}\r\n`);
                }
                break;
            case 'cat':
                const file = root.children?.find(f => f.name === args[0]);
                if (file) ws.send(`${file.content || '(empty)'}\r\n`);
                else ws.send(`cat: ${args[0]}: No such file\r\n`);
                break;
            case 'whoami':
                ws.send(`NODE: ${config.name}\r\nPERSONA: ${config.agentType}\r\n`);
                break;
            case 'help':
                ws.send(`Builtins: ls, cd, mkdir, touch, rm, cat, whoami, help, clear\r\nUse natural language for AI assistance.\r\n`);
                break;
            case 'clear':
                ws.send('\x1b[2J\x1b[H');
                break;
            case 'cd':
                const path = args[0] || '/';
                const updated = { ...config, cwd: path };
                await this.ctx.storage.put("config", updated);
                this.config = updated;
                break;
        }
    }
}