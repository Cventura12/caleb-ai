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

# Owner auth — required for /owner area
OWNER_PASSWORD=your-strong-password-here
SESSION_SECRET=your-64-char-hex-secret-here  # see below

# Owner control panel — Supabase + encryption (required for /owner panel)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ENCRYPTION_KEY=your-64-char-hex-encryption-key-here
```

Generate strong secrets:

```bash
# SESSION_SECRET and ENCRYPTION_KEY — run once each, save in a password manager
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Supabase setup (one-time):**

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor (Database → SQL Editor → New query)
3. Copy Project URL → `SUPABASE_URL`
4. Copy service_role secret key → `SUPABASE_SERVICE_ROLE_KEY` (never expose this)
5. Generate a fresh hex key → `ENCRYPTION_KEY`

**Where to get each value:**

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CALENDLY_API_TOKEN` | calendly.com/integrations/api_webhooks → Personal Access Tokens |
| `CALENDLY_EVENT_SLUG` | The slug in your event type's URL: `calendly.com/you/THIS-PART` |
| `RESEND_API_KEY` | resend.com → API Keys |
| `OWNER_EMAIL` | Your email address (where visitor messages are delivered) |
| `RESEND_FROM_EMAIL` | Optional. Defaults to `onboarding@resend.dev`. Set to `noreply@yourdomain.com` after verifying a domain. |
| `OWNER_PASSWORD` | A strong password you choose — only you need to know it |
| `SESSION_SECRET` | 32 random bytes as hex — run the command above |
| `SUPABASE_URL` | supabase.com → your project → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → your project → Settings → API → service_role (keep secret) |
| `ENCRYPTION_KEY` | 32 random bytes as hex — run the command above (separate key from SESSION_SECRET) |

```bash
npm run dev   # http://localhost:3000
npm run build # production build check
```

## Deploy

Import to Vercel and add the variables above as environment variables in the dashboard (Settings → Environment Variables). `CALENDLY_*` and `RESEND_*` / `OWNER_EMAIL` are optional — omit them to disable those tools.
