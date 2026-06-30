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

# Resend — leave_message tool (optional — messaging tool is disabled if unset)
RESEND_API_KEY=your-resend-api-key-here
OWNER_EMAIL=you@example.com
# RESEND_FROM_EMAIL=onboarding@resend.dev  # default; change after domain verification
```

**Where to get each value:**

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CALENDLY_API_TOKEN` | calendly.com/integrations/api_webhooks → Personal Access Tokens |
| `CALENDLY_EVENT_SLUG` | The slug in your event type's URL: `calendly.com/you/THIS-PART` |
| `RESEND_API_KEY` | resend.com → API Keys |
| `OWNER_EMAIL` | Your email address (where visitor messages are delivered) |
| `RESEND_FROM_EMAIL` | Optional. Defaults to `onboarding@resend.dev` (no domain setup needed if `OWNER_EMAIL` matches your Resend account email). Set to `noreply@yourdomain.com` after verifying a domain at resend.com/domains. |

```bash
npm run dev   # http://localhost:3000
npm run build # production build check
```

## Deploy

Import to Vercel and add the variables above as environment variables in the dashboard (Settings → Environment Variables). `CALENDLY_*` and `RESEND_*` / `OWNER_EMAIL` are optional — omit them to disable those tools.
