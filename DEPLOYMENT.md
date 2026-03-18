# ChitVault SaaS — Deployment Guide

## Architecture — Single Domain, Multi-Tenant

All firms share one URL: **chitvault.app**

```
chitvault.app          → Landing page
chitvault.app/login    → All firms log in here (same URL)
chitvault.app/register → New firm registration
chitvault.app/admin    → Your super-admin dashboard

Each user's firm_id on their profile automatically
isolates their data via Supabase RLS.
No subdomains. No wildcard DNS. No per-client config.
```

---

## Deploy to Vercel (Free)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd chitvault-saas
vercel

# Follow prompts — it asks for env vars
# Or set them in Vercel Dashboard → Settings → Environment Variables:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_APP_NAME
#   NEXT_PUBLIC_APP_URL
```

### Add your custom domain (optional)
```
Vercel Dashboard → Your Project → Settings → Domains
Add: chitvault.app
Add: www.chitvault.app

At your domain registrar, add:
  CNAME  www  →  cname.vercel-dns.com
  A      @    →  76.76.21.21
```

---

## How Multi-Tenancy Works (No Subdomains Needed)

1. Firm A registers → gets `firm_id = uuid-aaa`
2. Firm B registers → gets `firm_id = uuid-bbb`
3. Both log in at `chitvault.app/login`
4. After login, middleware reads `profiles.firm_id` from DB
5. All Supabase queries are filtered by `firm_id` via RLS
6. Firm A never sees Firm B's data — enforced at database level

---

## First Time Setup

```bash
# 1. Clone and install
git clone https://github.com/you/chitvault.git
cd chitvault
npm install

# 2. Set up env
cp .env.example .env.local
# Edit .env.local with your Supabase URL and key

# 3. Run schema
# Paste supabase_schema_saas.sql into Supabase SQL Editor

# 4. Start dev server
npm run dev
# Open http://localhost:3000

# 5. Register your account at /register
# Then in Supabase SQL Editor, make yourself superadmin:
# update profiles set role = 'superadmin' where id = '<your-id>';
```

---

## URL Flow

| Action | URL |
|---|---|
| Landing page | `chitvault.app` |
| Sign in | `chitvault.app/login` |
| New firm registration | `chitvault.app/register` |
| After login | `chitvault.app/dashboard` |
| Admin panel (you only) | `chitvault.app/admin` |
| Staff invite link | `chitvault.app/invite/<uuid>` |
