import { DurableObject } from "cloudflare:workers";
import type { TerminalConfig, AgentType, ApiResponse, FileSystemItem, InterNodeMessage } from '@shared/types';
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
            name: "New Agent",
            agentType: 'system',
            systemPrompt: "You are a helpful Synapse system agent.",
            status: 'online',
            cwd: '/',
            isSystemNode: false
        };
        const rootFS: FileSystemItem = {
            name: '/',
            type: 'dir',
            children: [
                { name: 'logs', type: 'dir', children: [] },
                { name: 'manifest.json', type: 'file', content: '{"version": "1.0.0"}' }
            ]
        };
        await this.ctx.storage.put("fs_root", rootFS);
        await this.ctx.storage.put("config", defaultConfig);
        this.config = defaultConfig;
        return defaultConfig;
    }
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname.includes('/connect')) {
            const upgradeHeader = request.headers.get('Upgrade');
            if (!upgradeHeader || upgradeHeader !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }
            const pair = new WebSocketPair();
            const [client, server] = [pair[0], pair[1]];
            await this.handleWebSocket(server);
            return new Response(null, { status: 101, webSocket: client });
        }
        if (url.pathname.includes('/config')) {
            if (request.method === 'GET') {
                const config = await this.ensureConfig();
                return Response.json({ success: true, data: config } satisfies ApiResponse<TerminalConfig>);
            }
            if (request.method === 'PUT') {
                const updates = await request.json() as Partial<TerminalConfig>;
                const current = await this.ensureConfig();
                const updated = { ...current, ...updates };
                await this.ctx.storage.put("config", updated);
                this.config = updated;
                this.broadcast(`\r\n\x1b[35m[SYSTEM] Configuration updated: ${updated.agentType} mode active.\x1b[0m\r\n\x1b[32muser@synapse:${updated.cwd}$ \x1b[0m`);
                return Response.json({ success: true, data: updated } satisfies ApiResponse<TerminalConfig>);
            }
        }
        if (url.pathname.includes('/execute') && request.method === 'POST') {
            const msg = await request.json() as InterNodeMessage;
            const config = await this.ensureConfig();
            return Response.json({ 
                success: true, 
                data: `[${config.name}] Processed remote command: "${msg.payload.command}" from node ${msg.from}` 
            });
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
        ws.send(`\r\n\x1b[33m[SYNAPSE]\x1b[0m Node: ${config.name} (${config.agentType})\r\n`);
        ws.send(`\x1b[90mID: ${this.ctx.id.toString()}\x1b[0m\r\n`);
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
        if (command.startsWith('@')) {
            const parts = command.slice(1).split(' ');
            const target = parts[0];
            const remoteCmd = parts.slice(1).join(' ');
            ws.send(`\x1b[36m[ROUTING]\x1b[0m Forwarding to node: ${target}...\r\n`);
            try {
                const stub = this.env.GlobalDurableObject.get(this.env.GlobalDurableObject.idFromName(target));
                const res = await stub.fetch(new Request(`http://do/execute`, {
                    method: 'POST',
                    body: JSON.stringify({
                        from: config.id,
                        to: target,
                        type: 'command',
                        payload: { command: remoteCmd }
                    } satisfies InterNodeMessage)
                }));
                const result = await res.json() as ApiResponse<string>;
                ws.send(`\x1b[34m[REMOTE]\x1b[0m ${result.data}\r\n`);
            } catch (e) {
                ws.send(`\x1b[31m[ERROR]\x1b[0m Routing failed: ${target} unreachable.\r\n`);
            }
            return;
        }
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        switch (cmd) {
            case 'cd': {
                const path = args[0] || '/';
                if (path === '/') config.cwd = '/';
                else if (path === '..') {
                    const parts = config.cwd.split('/').filter(Boolean);
                    parts.pop();
                    config.cwd = '/' + parts.join('/');
                } else {
                    config.cwd = (config.cwd === '/' ? '' : config.cwd) + '/' + path;
                }
                await this.ctx.storage.put("config", config);
                this.config = config;
                break;
            }
            case 'mkdir': {
                const name = args[0];
                if (!name) return ws.send('Usage: mkdir <name>\r\n');
                const root = await this.ctx.storage.get<FileSystemItem>("fs_root");
                if (root?.children) {
                    root.children.push({ name, type: 'dir', children: [] });
                    await this.ctx.storage.put("fs_root", root);
                    ws.send(`Created directory: ${name}\r\n`);
                }
                break;
            }
            case 'touch': {
                const name = args[0];
                if (!name) return ws.send('Usage: touch <name>\r\n');
                const root = await this.ctx.storage.get<FileSystemItem>("fs_root");
                if (root?.children) {
                    root.children.push({ name, type: 'file', content: '' });
                    await this.ctx.storage.put("fs_root", root);
                    ws.send(`Created file: ${name}\r\n`);
                }
                break;
            }
            case 'ls': {
                const root = await this.ctx.storage.get<FileSystemItem>("fs_root");
                if (root?.children) {
                    const output = root.children.map(item =>
                        item.type === 'dir' ? `\x1b[34m${item.name}/\x1b[0m` : item.name
                    ).join('  ');
                    ws.send(output + '\r\n');
                }
                break;
            }
            case 'pwd':
                ws.send(`${config.cwd}\r\n`);
                break;
            case 'whoami':
                ws.send(`\x1b[36mNODE IDENTITY\x1b[0m\r\nID: ${this.ctx.id.toString()}\r\nRole: ${config.agentType}\r\n`);
                break;
            case 'help':
                ws.send('\x1b[36mCommands:\x1b[0m cd, mkdir, touch, ls, pwd, whoami, @[id], clear, help\r\n');
                break;
            case 'clear':
                ws.send('\x1b[2J\x1b[H');
                break;
            default:
                ws.send(`\x1b[33m[${config.agentType.toUpperCase()}]\x1b[0m Executing: ${command}...\r\n`);
                await new Promise(r => setTimeout(r, 400));
                ws.send(`Command execution successful.\r\n`);
        }
    }
}