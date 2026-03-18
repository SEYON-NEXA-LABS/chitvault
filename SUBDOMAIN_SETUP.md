# ChitVault — Custom Subdomain Setup Guide

Each client gets their own subdomain like `kumari-chits.chitvault.app`.
This guide explains how to set it up on Vercel.

---

## How Subdomains Work

When a client registers with slug `kumari-chits`:
- Their app URL becomes: `kumari-chits.chitvault.app`
- The middleware reads the subdomain and resolves their `firm_id`
- RLS ensures they only see their own data

---

## Vercel Setup (One-time)

### 1. Add wildcard domain in Vercel
Go to your Vercel project → Settings → Domains → Add:
```
*.chitvault.app
```

### 2. Add DNS record at your domain registrar
```
Type:  CNAME
Name:  *
Value: cname.vercel-dns.com
TTL:   Auto
```

That's it. Every new slug automatically works as a subdomain.

---

## How the middleware resolves firm from subdomain

```typescript
const hostname  = request.headers.get('host')  // "kumari-chits.chitvault.app"
const subdomain = hostname.replace('.chitvault.app', '')  // "kumari-chits"

// Look up firm by slug and pass firm_id via header or cookie
const { data: firm } = await supabase.from('firms').select('id').eq('slug', subdomain)
```

---

## Per-Client Vanity Domains (Advanced)

If a client wants `app.kumari-chits.in` instead of a subdomain:

1. Client adds CNAME: `app.kumari-chits.in → cname.vercel-dns.com`
2. You add the domain in Vercel: Settings → Domains → `app.kumari-chits.in`
3. Store `custom_domain` in the `firms` table
4. Middleware checks custom domain and resolves firm_id

---

## Checking subdomain resolution

```
# Should load Kumari Chit Funds' dashboard
https://kumari-chits.chitvault.app

# Main marketing site
https://chitvault.app

# Your admin panel
https://chitvault.app/admin
```
