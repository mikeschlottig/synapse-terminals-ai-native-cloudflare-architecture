import { DurableObject } from "cloudflare:workers";
import type { TerminalConfig, AgentType, ApiResponse, FileSystemItem, InterNodeMessage, MeshNode } from '@shared/types';
import { Env } from "./core-utils";
export class GlobalDurableObject extends DurableObject<Env> {
    private sessions: Set<WebSocket> = new Set();
    private config: TerminalConfig | null = null;
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
            systemPrompt: "You are a helpful Synapse system agent.",
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
        // Registry Management (Routes to 'global' ID)
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
        // Terminal Specific Endpoints
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
                this.broadcast(`\r\n\x1b[35m[SYSTEM] Config Sync: ${updated.agentType.toUpperCase()} initialized.\x1b[0m\r\n\x1b[32muser@synapse:${updated.cwd}$ \x1b[0m`);
                return Response.json({ success: true, data: updated });
            }
        }
        if (url.pathname.includes('/execute') && request.method === 'POST') {
            const msg = await request.json() as InterNodeMessage;
            const config = await this.ensureConfig();
            return Response.json({ success: true, data: `[${config.name}] Remote CMD: "${msg.payload.command}" processed successfully.` });
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
        // Boot Sequence Simulation
        ws.send(`\x1b[1;36m>> SYNCING WITH MESH REGISTRY...\x1b[0m\r\n`);
        ws.send(`\x1b[90m[OK] Neural uplink established\x1b[0m\r\n`);
        ws.send(`\x1b[90m[OK] Loading persona: ${config.agentType}\x1b[0m\r\n`);
        ws.send(`\x1b[90m[OK] Filesystem check complete\x1b[0m\r\n\r\n`);
        ws.send(`\x1b[33m[SYNAPSE]\x1b[0m Node: ${config.name} online.\r\n`);
        ws.send(`\x1b[32muser@synapse:${config.cwd}$ \x1b[0m`);
        let inputBuffer = '';
        ws.addEventListener('message', async (event) => {
            const data = event.data as string;
            if (data === '\r') {
                const command = inputBuffer.trim();
                ws.send('\r\n');
                await this.processCommand(ws, command);
                const currentConfig = await this.ensureConfig();
                inputBuffer = '';
                ws.send(`\r\n\x1b[32muser@synapse:${currentConfig.cwd}$ \x1b[0m`);
            } else if (data === '\u007f') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    ws.send('\b \b');
                }
            } else {
                inputBuffer += data;
                ws.send(data);
            }
        });
        ws.addEventListener('close', () => this.sessions.delete(ws));
    }
    private async processCommand(ws: WebSocket, command: string) {
        if (!command) return;
        const config = await this.ensureConfig();
        const root = await this.ctx.storage.get<FileSystemItem>("fs_root");
        if (command.startsWith('@')) {
            const parts = command.slice(1).split(' ');
            const target = parts[0];
            const remoteCmd = parts.slice(1).join(' ');
            ws.send(`\x1b[36m[ROUTING]\x1b[0m Proxying request to ${target}...\r\n`);
            try {
                const stub = this.env.GlobalDurableObject.get(this.env.GlobalDurableObject.idFromName(target));
                const res = await stub.fetch(new Request(`http://do/execute`, {
                    method: 'POST',
                    body: JSON.stringify({ from: config.id, to: target, type: 'command', payload: { command: remoteCmd } })
                }));
                const result = await res.json() as ApiResponse<string>;
                ws.send(`\x1b[34m[REMOTE]\x1b[0m ${result.data}\r\n`);
            } catch (e) {
                ws.send(`\x1b[31m[ERROR]\x1b[0m Peer node unreachable.\r\n`);
            }
            return;
        }
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        switch (cmd) {
            case 'cat': {
                const name = args[0];
                const file = root?.children?.find(f => f.name === name);
                if (!file) ws.send(`cat: ${name}: No such file\r\n`);
                else if (file.type === 'dir') ws.send(`cat: ${name}: Is a directory\r\n`);
                else ws.send(`${file.content}\r\n`);
                break;
            }
            case 'echo': {
                const text = args.join(' ');
                ws.send(`${text}\r\n`);
                break;
            }
            case 'ls': {
                const output = root?.children?.map(item =>
                    item.type === 'dir' ? `\x1b[1;34m${item.name}/\x1b[0m` : item.name
                ).join('  ');
                ws.send(`${output || 'empty'}\r\n`);
                break;
            }
            case 'whoami':
                ws.send(`\x1b[36mNODE IDENTITY\x1b[0m\r\nID: ${this.ctx.id.toString()}\r\nPersona: ${config.agentType.toUpperCase()}\r\n`);
                break;
            case 'help':
                ws.send('\x1b[36mCommands:\x1b[0m cat, ls, echo, whoami, @[node], clear, help\r\n');
                break;
            case 'clear':
                ws.send('\x1b[2J\x1b[H');
                break;
            default: {
                // Persona-aware response logic
                const prefixes: Record<AgentType, string[]> = {
                    coder: ['Analyzing bytecode...', 'Refactoring neural logic...', 'Compiling heuristic functions...'],
                    security: ['Running firewall audit...', 'Scanning for buffer overflows...', 'Hardening node integrity...'],
                    reviewer: ['Parsing execution trace...', 'Checking logic compliance...', 'Validating mesh standards...'],
                    system: ['Scheduling task thread...', 'Allocating shared memory...', 'Optimizing packet route...']
                };
                const choices = prefixes[config.agentType] || prefixes.system;
                const prefix = choices[Math.floor(Math.random() * choices.length)];
                const colors: Record<AgentType, string> = { coder: '36', security: '32', reviewer: '33', system: '35' };
                const color = colors[config.agentType] || '35';
                ws.send(`\x1b[${color}m[${config.agentType.toUpperCase()}]\x1b[0m ${prefix}\r\n`);
                await new Promise(r => setTimeout(r, 600));
                ws.send(`\x1b[1;32mExecution complete.\x1b[0m Verification token: ${Math.random().toString(36).slice(2, 10).toUpperCase()}\r\n`);
                // Track message count in storage for telemetry
                const count = (await this.ctx.storage.get<number>("msg_count") || 0) + 1;
                await this.ctx.storage.put("msg_count", count);
            }
        }
    }
}