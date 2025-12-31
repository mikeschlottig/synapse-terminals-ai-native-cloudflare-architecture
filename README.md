# Synapse Terminals

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mikeschlottig/synapse-terminals-ai-native-cloudflare-architecture)

A modern full-stack application template powered by Cloudflare Workers and Pages. This project combines a high-performance React frontend with a serverless Hono backend, featuring Durable Objects for persistent state management. Built with TypeScript, Tailwind CSS, and shadcn/ui for a production-ready developer experience.

## Features

- **Full-Stack Architecture**: React 18 frontend served via Cloudflare Pages with API routes handled by Workers.
- **Durable Objects**: Built-in stateful storage for counters, demo items, and custom data persistence.
- **Type-Safe APIs**: Shared TypeScript types between frontend and backend.
- **Modern UI**: shadcn/ui components, Tailwind CSS with custom theming, dark mode support.
- **Developer Tools**: TanStack Query for data fetching, React Router, error boundaries, and client error reporting.
- **Production-Ready**: CORS, logging, health checks, and automatic bundling with Vite.
- **Responsive Design**: Mobile-first layout with sidebar support and animations.
- **Demo Endpoints**: Ready-to-use APIs for testing counters and CRUD operations.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide React, Framer Motion, TanStack Query, React Router, Sonner (toasts)
- **Backend**: Hono, Cloudflare Workers, Durable Objects
- **Utilities**: Zod (validation), Immer (state), clsx/tw-merge (styling), uuid
- **Dev Tools**: Bun (package manager), ESLint, TypeScript 5, Wrangler

## Quick Start

1. **Clone the repository**:
   ```
   git clone <your-repo-url>
   cd synapse-terminals--v7s1dgqkjbc1g1fupsap
   ```

2. **Install dependencies** (using Bun):
   ```
   bun install
   ```

3. **Run in development**:
   ```
   bun dev
   ```
   Opens at `http://localhost:3000` (or `$PORT`).

4. **Generate Worker types** (if needed):
   ```
   bun run cf-typegen
   ```

## Development

### Project Structure
```
├── src/              # React frontend
├── worker/           # Cloudflare Worker backend
├── shared/           # Shared types and mock data
├── vite.config.ts    # Frontend bundler config
└── wrangler.jsonc    # Worker deployment config
```

### Scripts
| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server (frontend + hot reload) |
| `bun build` | Build frontend assets |
| `bun lint` | Run ESLint |
| `bun preview` | Preview production build |
| `bun run cf-typegen` | Generate Worker bindings types |

### Key Files to Customize
- `src/pages/HomePage.tsx`: Main application UI (replace the demo).
- `worker/userRoutes.ts`: Add your API routes here (do not edit `worker/index.ts`).
- `worker/durableObject.ts`: Extend Durable Object methods.
- `src/components/app-sidebar.tsx`: Customize navigation.
- `tailwind.config.js` & `src/index.css`: Theme and styling.

### Environment Variables
No required env vars. Bindings are auto-configured via Wrangler.

### API Endpoints (Demo)
- `GET /api/health`: Health check.
- `GET/POST /api/counter`: Stateful counter.
- `GET/POST/PUT/DELETE /api/demo`: CRUD demo items.
- `POST /api/client-errors`: Client-side error reporting.

Test with `curl` or frontend queries.

## Deployment

Deploy to Cloudflare Pages with Workers in one command:

```
bun run deploy
```

This builds the frontend and deploys via Wrangler.

### Manual Deployment Steps
1. **Login to Cloudflare**:
   ```
   bunx wrangler login
   ```

2. **Deploy**:
   ```
   bun run build
   bunx wrangler deploy
   ```

3. **Custom Domain** (optional):
   Edit `wrangler.jsonc` and run `wrangler deploy`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mikeschlottig/synapse-terminals-ai-native-cloudflare-architecture)

### Pages Integration
- Frontend assets served as SPA.
- API routes (`/api/*`) handled by Worker first.
- Durable Objects auto-migrate on deploy.

## Contributing

1. Fork and clone.
2. Install with `bun install`.
3. Create a feature branch: `git checkout -b feature/your-feature`.
4. Commit changes: `git commit -m "Add feature"`.
5. Push and open a PR.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [shadcn/ui](https://ui.shadcn.com/)
- File issues here for template bugs.