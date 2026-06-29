# caleb.ai

Personal website — a chat interface where visitors talk to an AI trained to be me.

Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS v4. The Anthropic API key lives exclusively on the server; the browser never touches it.

## Setup

```bash
npm install
```

Create `.env.local` (never committed):

```
ANTHROPIC_API_KEY=your-key-here
```

```bash
npm run dev   # http://localhost:3000
npm run build # production build check
```

## Deploy

Import to Vercel and add `ANTHROPIC_API_KEY` as an environment variable in the dashboard. No other config needed.
