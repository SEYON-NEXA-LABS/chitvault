# ChitVault SaaS — Deployment Guide

## Architecture — Single Domain, Multi-Tenant

All firms share one URL: **chitvault.in**

```
chitvault.in          → Landing page
chitvault.in/login    → All firms log in here (same URL)
chitvault.in/register → New firm registration
chitvault.in/admin    → Your super-admin dashboard

Each user's firm_id on their profile automatically
isolates their data via Supabase RLS.
No subdomains. No wildcard DNS. No per-client config.
```

---

## 🚀 Deploy to Hostinger (VPS + PM2)

ChitVault uses a **Hybrid Cloud** setup:
- **Web App**: Hosted on Hostinger (VPS) for low-latency web rendering.
- **Database**: Hosted on Supabase for reliable auth and real-time data.

### 1. Server Environment Setup
Before deploying, ensure your Hostinger VPS has Node.js (v18+) and PM2 installed:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (via NVM recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 18

# Install PM2 (Process Manager)
npm install -g pm2
```

### 2. Deploy Codebase
SSH into your Hostinger VPS and run the following:

```bash
# Clone the repository
git clone https://github.com/seyonnexalabs-cyber/chitvault.git
cd chitvault

# Install dependencies and build
npm install
npm run build
```

### 3. Start the Production Server
Use PM2 to ensure the Next.js app stays alive and restarts on failure:

```bash
# Start Next.js on port 3000
pm2 start npm --name "chitvault" -- start

# Save PM2 process list
pm2 save
pm2 startup
```

### 4. Reverse Proxy & SSL (Nginx)
Configure Nginx to point `chitvault.in` (port 80/443) to your Next.js app (port 3000):

```bash
# Install Nginx and Certbot
sudo apt install nginx python3-certbot-nginx -y

# Create Nginx config: /etc/nginx/sites-available/chitvault
# Server block should proxy to http://localhost:3000

# Enable SSL
sudo certbot --nginx -d chitvault.in -d www.chitvault.in
```

---

## How Multi-Tenancy Works (No Subdomains Needed)

1. Firm A registers → gets `firm_id = uuid-aaa`
2. Firm B registers → gets `firm_id = uuid-bbb`
3. Both log in at `chitvault.in/login`
4. After login, middleware reads `profiles.firm_id` from DB
5. All Supabase queries are filtered by `firm_id` via RLS
6. Firm A never sees Firm B's data — enforced at database level

---

## First Time Setup

```bash
# 1. Clone and install
git clone https://github.com/seyonnexalabs-cyber/chitvault.git
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
| Landing page | `chitvault.in` |
| Sign in | `chitvault.in/login` |
| New firm registration | `chitvault.in/register` |
| After login | `chitvault.in/dashboard` |
| Admin panel (you only) | `chitvault.in/admin` |
| Staff invite link | `chitvault.in/invite/<uuid>` |
