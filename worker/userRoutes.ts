import { Hono } from "hono";
import { Env } from './core-utils';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Global Mesh Registry (routed to a single stable 'global' DO)
    app.get('/api/mesh/nodes', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        return stub.fetch(c.req.raw);
    });
    app.post('/api/mesh/register', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        return stub.fetch(c.req.raw);
    });
    // WebSocket Upgrade & Terminal Ops (routed to specific node ID)
    app.get('/api/terminal/:id/connect', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        return stub.fetch(c.req.raw);
    });
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
    app.post('/api/terminal/:id/execute', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        return stub.fetch(c.req.raw);
    });
}