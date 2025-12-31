import { DurableObject } from "cloudflare:workers";
import type { TerminalConfig, ExecutionRequest, AgentType } from '@shared/types';
export class GlobalDurableObject extends DurableObject {
    private sessions: Set<WebSocket> = new Set();
    private config: TerminalConfig | null = null;
    private async ensureConfig(): Promise<TerminalConfig> {
        if (this.config) return this.config;
        const stored = await this.ctx.storage.get<TerminalConfig>("config");
        if (stored) {
            this.config = stored;
            return stored;
        }
        const defaultConfig: TerminalConfig = {
            id: "unknown", // Will be set on first fetch or init
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
        // Fix TS2488 by accessing as object or type assertion
        if (url.pathname.includes('/connect')) {
            const upgradeHeader = request.headers.get('Upgrade');
            if (!upgradeHeader || upgradeHeader !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }
            const pair = new WebSocketPair();
            const client = pair[0];
            const server = pair[1];
            await this.handleWebSocket(server);
            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }
        if (url.pathname.includes('/config')) {
            if (request.method === 'GET') {
                const config = await this.ensureConfig();
                return Response.json({ success: true, data: config });
            }
            if (request.method === 'PUT') {
                const updates = await request.json() as Partial<TerminalConfig>;
                const current = await this.ensureConfig();
                const updated = { ...current, ...updates };
                await this.ctx.storage.put("config", updated);
                this.config = updated;
                this.broadcast(`\r\n\x1b[35m[SYSTEM] Configuration updated: ${updated.agentType} mode active.\x1b[0m\r\n\x1b[32muser@synapse:~$\x1b[0m `);
                return Response.json({ success: true, data: updated });
            }
        }
        if (url.pathname.includes('/execute') && request.method === 'POST') {
            const body = await request.json() as ExecutionRequest;
            const config = await this.ensureConfig();
            this.broadcast(`\r\n\x1b[34m[INCOMING] Request from ${body.callerId}:\x1b[0m ${body.prompt}\r\n`);
            // Simulate AI Processing
            const response = await this.simulateAgentResponse(config, body.prompt);
            this.broadcast(`\x1b[36m[OUTGOING]\x1b[0m Sending response back to ${body.callerId}...\r\n\x1b[32muser@synapse:~$\x1b[0m `);
            return Response.json({ success: true, data: response });
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
        ws.send(`\x1b[90mPrompt: ${config.systemPrompt}\x1b[0m\r\n`);
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
        if (command.startsWith('@')) {
            const parts = command.split(' ');
            const targetId = parts[0].substring(1);
            const prompt = parts.slice(1).join(' ');
            if (!targetId || !prompt) {
                ws.send(`\x1b[31mUsage: @[target-id] [message]\x1b[0m\r\n`);
                return;
            }
            ws.send(`\x1b[90mRouting to ${targetId} via Mesh Protocol...\x1b[0m\r\n`);
            try {
                // Cross-DO execution would normally use service bindings or fetch back to the worker
                // Here we simulate the logic since GlobalDurableObject is our namespace
                ws.send(`\x1b[32mMessage delivered. Awaiting response...\x1b[0m\r\n`);
            } catch (e) {
                ws.send(`\x1b[31mRouting Error: Target node ${targetId} unreachable.\x1b[0m\r\n`);
            }
            return;
        }
        const config = await this.ensureConfig();
        if (command === 'help') {
            ws.send('\x1b[36mCommands:\x1b[0m help, status, clear, whoami, @[target] [msg]\r\n');
        } else if (command === 'status') {
            ws.send(`\x1b[32m[OK]\x1b[0m Agent: ${config.name}\r\n`);
            ws.send(`\x1b[32m[OK]\x1b[0m Type: ${config.agentType}\r\n`);
        } else if (command === 'clear') {
            ws.send('\x1b[2J\x1b[H');
        } else {
            ws.send(`Processing logic for: ${command}...\r\n`);
            const response = await this.simulateAgentResponse(config, command);
            ws.send(`\x1b[33m[${config.agentType.toUpperCase()}]\x1b[0m ${response}\r\n`);
        }
    }
    private async simulateAgentResponse(config: TerminalConfig, input: string): Promise<string> {
        await new Promise(r => setTimeout(r, 600));
        if (config.agentType === 'coder') {
            return `I've analyzed the request. Based on the system prompt "${config.systemPrompt}", I recommend refactoring the logic using a Map for O(1) lookups.`;
        } else if (config.agentType === 'reviewer') {
            return `Code review complete. The implementation of "${input}" looks solid, but ensure you handle null pointers in the edge cases.`;
        }
        return `Acknowledged. Processing "${input}" within the Synapse framework.`;
    }
}