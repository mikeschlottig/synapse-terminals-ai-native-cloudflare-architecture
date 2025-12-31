import { DurableObject } from "cloudflare:workers";
import type { DemoItem } from '@shared/types';
export class GlobalDurableObject extends DurableObject {
    private sessions: Set<WebSocket> = new Set();
    private history: string[] = [];
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname.includes('/connect')) {
            const upgradeHeader = request.headers.get('Upgrade');
            if (!upgradeHeader || upgradeHeader !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }
            const [client, server] = new WebSocketPair();
            await this.handleWebSocket(server);
            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }
        return new Response('Not Found', { status: 404 });
    }
    private async handleWebSocket(ws: WebSocket) {
        ws.accept();
        this.sessions.add(ws);
        // Send initial greeting
        ws.send(`\r\n\x1b[33m[SYSTEM]\x1b[0m Synapse Node initialized. Type 'help' for commands.\r\n`);
        ws.send(`\x1b[32muser@synapse:~$\x1b[0m `);
        let inputBuffer = '';
        ws.addEventListener('message', async (event) => {
            const data = event.data as string;
            // Handle backspace/enter/character echo
            if (data === '\r') {
                const command = inputBuffer.trim().toLowerCase();
                ws.send('\r\n');
                await this.processCommand(ws, command);
                inputBuffer = '';
                ws.send(`\r\n\x1b[32muser@synapse:~$\x1b[0m `);
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
        ws.addEventListener('close', () => {
            this.sessions.delete(ws);
        });
    }
    private async processCommand(ws: WebSocket, command: string) {
        if (!command) return;
        if (command === 'help') {
            ws.send('\x1b[36mAvailable Commands:\x1b[0m\r\n');
            ws.send('  help     - Show this menu\r\n');
            ws.send('  status   - Check agent diagnostics\r\n');
            ws.send('  clear    - Clear terminal\r\n');
            ws.send('  whoami   - Display identity\r\n');
            ws.send('  ping     - Test latency\r\n');
        } else if (command === 'status') {
            ws.send('Initializing diagnostics...\r\n');
            await new Promise(r => setTimeout(r, 500));
            ws.send('\x1b[32m[OK]\x1b[0m Memory: 1.2GB/16GB\r\n');
            ws.send('\x1b[32m[OK]\x1b[0m Neural Bridge: Active\r\n');
            ws.send('\x1b[32m[OK]\x1b[0m Durable Objects: Healthy\r\n');
        } else if (command === 'whoami') {
            ws.send('\x1b[35mSynapse Agent v3.1.2 - "Lumina"\x1b[0m\r\n');
            ws.send('Authorized access level: Root\r\n');
        } else if (command === 'ping') {
            ws.send('PONG (14ms)\r\n');
        } else if (command === 'clear') {
            ws.send('\x1b[2J\x1b[H');
        } else {
            ws.send(`\x1b[31mError:\x1b[0m Command not found: ${command}\r\n`);
            ws.send(`Simulating AI thought process...\r\n`);
            await new Promise(r => setTimeout(r, 800));
            ws.send(`\x1b[33m[AGENT]\x1b[0m It seems you're trying to execute "${command}". I don't have that in my current manifest, but I can assist with system diagnostics.\r\n`);
        }
    }
    // Keep existing boilerplate methods for type safety but they aren't primary focus now
    async getCounterValue(): Promise<number> { return 0; }
    async increment(): Promise<number> { return 0; }
    async getDemoItems(): Promise<DemoItem[]> { return []; }
    async addDemoItem(item: DemoItem): Promise<DemoItem[]> { return []; }
    async updateDemoItem(id: string, updates: any): Promise<DemoItem[]> { return []; }
    async deleteDemoItem(id: string): Promise<DemoItem[]> { return []; }
}