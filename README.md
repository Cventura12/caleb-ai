# caleb.ai

Personal website — a chat interface where visitors talk to an AI trained to be me.

Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS v4. All API keys live exclusively on the server; the browser never touches them.

## Setup

```bash
npm install
```

Create `.env.local` (never committed):

```
# Required
ANTHROPIC_API_KEY=your-key-here

# Calendly integration (optional — booking tool is disabled if unset)
CALENDLY_API_TOKEN=your-calendly-token-here
CALENDLY_EVENT_SLUG=30min
```

**Where to get each value:**

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CALENDLY_API_TOKEN` | calendly.com/integrations/api_webhooks → Personal Access Tokens |
| `CALENDLY_EVENT_SLUG` | The slug in your event type's URL: `calendly.com/you/THIS-PART` |

```bash
npm run dev   # http://localhost:3000
npm run build # production build check
```

## Deploy

Import to Vercel and add all three variables above as environment variables in the dashboard (Settings → Environment Variables). `CALENDLY_*` are optional — omit them to disable booking.
