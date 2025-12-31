import { Hono } from "hono";
import { Env } from './core-utils';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'Synapse API' }}));
    // WebSocket Connection Route
    // This route captures the ID and fetches the corresponding Durable Object
    app.get('/api/terminal/:id/connect', async (c) => {
        const id = c.req.param('id');
        // We use the ID as the name to get a persistent DO instance for this terminal session
        const durableObjectStub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName(id));
        // Forward the WebSocket upgrade request to the DO instance
        return durableObjectStub.fetch(c.req.raw);
    });
    // Cleanup: Remove old demo routes or keep them for reference if needed
    // But ensure the main /api/terminal route is priority
}