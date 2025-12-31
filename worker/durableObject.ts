import { DurableObject } from "cloudflare:workers";
import type { TerminalConfig, ExecutionRequest, AgentType, ApiResponse } from '@shared/types';
import { Env } from "./core-utils";
export class GlobalDurableObject extends DurableObject {
    private sessions: Set<WebSocket> = new Set();
    private config: TerminalConfig | null = null;
    private env: Env;
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.env = env;
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
            status: 'online'
        };
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
            return new Response(null, {
                status: 101,
                webSocket: client,
            });
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
                this.broadcast(`\r\n\x1b[35m[SYSTEM] Configuration updated: ${updated.agentType} mode active.\x1b[0m\r\n\x1b[32muser@synapse:~$\x1b[0m `);
                return Response.json({ success: true, data: updated } satisfies ApiResponse<TerminalConfig>);
            }
        }
        if (url.pathname.includes('/execute') && request.method === 'POST') {
            const body = await request.json() as ExecutionRequest;
            const config = await this.ensureConfig();
            this.broadcast(`\r\n\x1b[35m[MESSAGED_BY] Node ${body.callerId.slice(0, 8)}:\x1b[0m ${body.prompt}\r\n`);
            const response = await this.simulateAgentResponse(config, body.prompt, body.callerId);
            this.broadcast(`\x1b[36m[REPLYING]\x1b[0m Sent response back to ${body.callerId.slice(0, 8)}...\r\n\x1b[32muser@synapse:~$\x1b[0m `);
            return Response.json({ success: true, data: response } satisfies ApiResponse<string>);
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
        ws.send(`\x1b[32muser@synapse:~$\x1b[0m `);
        let inputBuffer = '';
        ws.addEventListener('message', async (event) => {
            const data = event.data as string;
            if (data === '\r') {
                const command = inputBuffer.trim();
                ws.send('\r\n');
                await this.processCommand(ws, command);
                inputBuffer = '';
                ws.send(`\r\n\x1b[32muser@synapse:~$\x1b[0m `);
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
            const parts = command.split(' ');
            const targetId = parts[0].substring(1);
            const prompt = parts.slice(1).join(' ');
            if (!targetId || !prompt) {
                ws.send(`\x1b[31mUsage: @[target-id] [message]\x1b[0m\r\n`);
                return;
            }
            ws.send(`\x1b[90mRouting to ${targetId.slice(0, 8)} via Mesh Grid...\x1b[0m\r\n`);
            try {
                const id = this.env.GlobalDurableObject.idFromName(targetId);
                const stub = this.env.GlobalDurableObject.get(id);
                const res = await stub.fetch(`http://do/api/terminal/${targetId}/execute`, {
                    method: 'POST',
                    body: JSON.stringify({
                        prompt,
                        callerId: this.ctx.id.toString()
                    } satisfies ExecutionRequest)
                });
                const result = await res.json() as ApiResponse<string>;
                if (result.success) {
                    ws.send(`\r\n\x1b[35m[RESPONSE from ${targetId.slice(0, 8)}]:\x1b[0m ${result.data}\r\n`);
                } else {
                    ws.send(`\x1b[31mExecution Failed: ${result.error}\x1b[0m\r\n`);
                }
            } catch (e) {
                ws.send(`\x1b[31mRouting Error: Node ${targetId.slice(0, 8)} unreachable.\x1b[0m\r\n`);
            }
            return;
        }
        switch (command) {
            case 'help':
                ws.send('\x1b[36mCommands:\x1b[0m help, status, clear, whoami, @[id] [msg]\r\n');
                break;
            case 'status':
                ws.send(`\x1b[32m[OK]\x1b[0m Node: ${config.name}\r\n`);
                ws.send(`\x1b[32m[OK]\x1b[0m Type: ${config.agentType}\r\n`);
                ws.send(`\x1b[32m[OK]\x1b[0m Status: ${config.status}\r\n`);
                break;
            case 'whoami':
                ws.send(`\x1b[36mNODE IDENTITY\x1b[0m\r\n`);
                ws.send(`ID: ${this.ctx.id.toString()}\r\n`);
                ws.send(`Role: ${config.agentType}\r\n`);
                ws.send(`Prompt: ${config.systemPrompt}\r\n`);
                break;
            case 'clear':
                ws.send('\x1b[2J\x1b[H');
                break;
            default:
                const response = await this.simulateAgentResponse(config, command, 'user');
                ws.send(`\x1b[33m[${config.agentType.toUpperCase()}]\x1b[0m ${response}\r\n`);
        }
    }
    private async simulateAgentResponse(config: TerminalConfig, input: string, caller: string): Promise<string> {
        await new Promise(r => setTimeout(r, 800));
        const contextPrefix = caller !== 'user' ? `[Mesh Call from ${caller.slice(0, 8)}] ` : '';
        if (config.agentType === 'coder') {
            return `${contextPrefix}I've processed the request. Recommendation: Use the provided context to implement a recursive strategy for ${input}.`;
        } else if (config.agentType === 'security') {
            return `${contextPrefix}Security audit for "${input}" initiated. No critical vulnerabilities detected in current buffer.`;
        } else if (config.agentType === 'reviewer') {
            return `${contextPrefix}Review complete. Logical flow for "${input}" is sound, but consider adding telemetry.`;
        }
        return `${contextPrefix}Command "${input}" acknowledged by Synapse Core.`;
    }
}