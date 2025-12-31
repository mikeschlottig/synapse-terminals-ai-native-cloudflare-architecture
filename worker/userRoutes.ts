import { Hono } from "hono";
import { Env } from './core-utils';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // WebSocket Upgrade
    app.get('/api/terminal/:id/connect', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        return stub.fetch(c.req.raw);
    });
    // Terminal Configuration
    app.get('/api/terminal/:id/config', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        return stub.fetch(c.req.raw);
    });
    app.put('/api/terminal/:id/config', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        return stub.fetch(c.req.raw);
    });
    // Inter-terminal Mesh Execution
    app.post('/api/terminal/:id/execute', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        return stub.fetch(c.req.raw);
    });
}