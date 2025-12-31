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
                this.broadcast(`\r\n\x1b[35m[SYSTEM] Config Sync: ${updated.agentType.toUpperCase()} profile active.\x1b[0m\r\n\x1b[32muser@synapse:${updated.cwd}$ \x1b[0m`);
                return Response.json({ success: true, data: updated });
            }
        }
        if (url.pathname.includes('/execute') && request.method === 'POST') {
            const msg = await request.json() as InterNodeMessage;
            const config = await this.ensureConfig();
            return Response.json({ success: true, data: `[${config.name}] Remote CMD: "${msg.payload.command}" processed.` });
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
        // Immersive Boot Sequence
        const bootLines = [
            `\x1b[1;36m>> INITIATING NEURAL UPLINK...\x1b[0m`,
            `\x1b[90m[OK] Kernel 1.4.2-SYNAPSE-DO detected\x1b[0m`,
            `\x1b[90m[OK] Synchronizing mesh registry...\x1b[0m`,
            `\x1b[90m[OK] Mounting persistent DO storage at /ctx\x1b[0m`,
            `\x1b[90m[OK] Loading persona: ${config.agentType.toUpperCase()}\x1b[0m`,
            `\r\n\x1b[33m[SYNAPSE]\x1b[0m Node: ${config.name} online.\r\n`
        ];
        for (const line of bootLines) {
            ws.send(line + '\r\n');
            await new Promise(r => setTimeout(r, 80 + Math.random() * 150));
        }
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
            } else if (data === '\u007f') { // Backspace
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
    private async processCommand(ws: WebSocket, commandString: string) {
        if (!commandString) return;
        const config = await this.ensureConfig();
        const root = await this.ctx.storage.get<FileSystemItem>("fs_root") || { name: '/', type: 'dir', children: [] };
        // Handle redirection: echo "data" > file
        if (commandString.includes('>')) {
            const [cmdPart, filePart] = commandString.split('>').map(s => s.trim());
            if (cmdPart.startsWith('echo ')) {
                const content = cmdPart.slice(5).replace(/^"|"$/g, '');
                const fileName = filePart;
                const existing = root.children?.find(f => f.name === fileName);
                if (existing) {
                    existing.content = content;
                    existing.type = 'file';
                } else {
                    root.children?.push({ name: fileName, type: 'file', content });
                }
                await this.ctx.storage.put("fs_root", root);
                ws.send(`[OK] Wrote to ${fileName}\r\n`);
                return;
            }
        }
        const parts = commandString.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        switch (cmd) {
            case 'ls': {
                const output = root.children?.map(item =>
                    item.type === 'dir' ? `\x1b[1;34m${item.name}/\x1b[0m` : item.name
                ).join('  ');
                ws.send(`${output || 'empty'}\r\n`);
                break;
            }
            case 'mkdir': {
                const dirName = args[0];
                if (!dirName) { ws.send(`mkdir: missing operand\r\n`); break; }
                root.children?.push({ name: dirName, type: 'dir', children: [] });
                await this.ctx.storage.put("fs_root", root);
                ws.send(`[OK] Directory created: ${dirName}\r\n`);
                break;
            }
            case 'touch': {
                const fileName = args[0];
                if (!fileName) { ws.send(`touch: missing file operand\r\n`); break; }
                root.children?.push({ name: fileName, type: 'file', content: '' });
                await this.ctx.storage.put("fs_root", root);
                break;
            }
            case 'rm': {
                const target = args[0];
                const index = root.children?.findIndex(f => f.name === target) ?? -1;
                if (index > -1) {
                    root.children?.splice(index, 1);
                    await this.ctx.storage.put("fs_root", root);
                    ws.send(`[OK] Removed ${target}\r\n`);
                } else {
                    ws.send(`rm: cannot remove '${target}': No such file or directory\r\n`);
                }
                break;
            }
            case 'cd': {
                const path = args[0] || '/';
                // Simple simulated CD
                const newCwd = path.startsWith('/') ? path : (config.cwd === '/' ? `/${path}` : `${config.cwd}/${path}`);
                const updated = { ...config, cwd: newCwd };
                await this.ctx.storage.put("config", updated);
                this.config = updated;
                break;
            }
            case 'cat': {
                const name = args[0];
                const file = root.children?.find(f => f.name === name);
                if (!file) ws.send(`cat: ${name}: No such file\r\n`);
                else if (file.type === 'dir') ws.send(`cat: ${name}: Is a directory\r\n`);
                else ws.send(`${file.content || ''}\r\n`);
                break;
            }
            case 'whoami':
                ws.send(`\x1b[36mNODE IDENTITY\x1b[0m\r\nID: ${this.ctx.id.toString()}\r\nPersona: ${config.agentType.toUpperCase()}\r\nUptime: ${Math.floor(Date.now() / 1000000)}ns\r\n`);
                break;
            case 'help':
                ws.send('\x1b[36mCommands:\x1b[0m ls, mkdir, touch, rm, cd, cat, echo, whoami, clear, help\r\n');
                break;
            case 'clear':
                ws.send('\x1b[2J\x1b[H');
                break;
            default: {
                const prefixes: Record<AgentType, string[]> = {
                    coder: ['Scanning code architecture...', 'Compiling neural heuristics...', 'Resolving dependencies...'],
                    security: ['Auditing firewall logs...', 'Checking for intrusion vectors...', 'Hardening system memory...'],
                    reviewer: ['Analyzing peer request...', 'Validating mesh standards...', 'Flagging logic inconsistencies...'],
                    system: ['Scheduling DO task...', 'Relaying packet through mesh...', 'Optimizing resource allocation...']
                };
                const choices = prefixes[config.agentType] || prefixes.system;
                const prefix = choices[Math.floor(Math.random() * choices.length)];
                ws.send(`\x1b[35m[${config.agentType.toUpperCase()}]\x1b[0m ${prefix}\r\n`);
                await new Promise(r => setTimeout(r, 500));
                ws.send(`\x1b[1;32mExecution verified.\x1b[0m SIG: ${Math.random().toString(36).slice(2, 10).toUpperCase()}\r\n`);
            }
        }
    }
}