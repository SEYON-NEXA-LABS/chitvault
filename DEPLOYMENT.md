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

## Deploy to Railway (Starter Plan)

```bash
# Install Railway CLI
npm install -g railway

# Login
railway login

# Deploy
cd chitvault
railway up

# Set env vars in Railway Dashboard → Your Project → Variables:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_APP_NAME
#   NEXT_PUBLIC_APP_URL
```

### Add your custom domain (optional)
```
Railway Dashboard → Your Project → Settings → Domains
Add: chitvault.app
Add: www.chitvault.app

At your domain registrar, add:
  CNAME  www  →  chitvault.up.railway.app
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
| Landing page | `chitvault.up.railway.app` |
| Sign in | `chitvault.up.railway.app/login` |
| New firm registration | `chitvault.up.railway.app/register` |
| After login | `chitvault.up.railway.app/dashboard` |
| Admin panel (you only) | `chitvault.up.railway.app/admin` |
| Staff invite link | `chitvault.up.railway.app/invite/<uuid>` |
