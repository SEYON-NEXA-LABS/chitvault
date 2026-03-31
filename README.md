# ChitVault SaaS

**Auction Chit Fund Management Software** — Multi-tenant SaaS built with Next.js 14, Supabase and TypeScript.

---

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Framework   | Next.js 14 (App Router)           |
| Database    | Supabase PostgreSQL                |
| Auth        | Supabase Auth (email + password)  |
| Styling     | Tailwind CSS + CSS Variables      |
| Language    | TypeScript                        |
| Deployment  | Railway (Starter Plan)        |
| Desktop     | Electron (optional .exe build)    |

---

## How Multi-Tenancy Works

Single domain. All firms log in at the same URL. Data is isolated by `firm_id` on every table, enforced at the database level via Supabase Row Level Security (RLS).

```
chitvault.up.railway.app/login    → All firms log in here
chitvault.up.railway.app/register → New firm self-registration
chitvault.up.railway.app/admin    → Super admin (your panel)
chitvault.up.railway.app/dashboard → Each firm's private workspace
```

After login, middleware reads `profiles.firm_id` and routes the user to their own dashboard. Firm A can never see Firm B's data — enforced at the DB level, not just the UI.

---

## User Roles

| Role       | Access |
|------------|--------|
| **Owner**  | Full access — create groups, add members, record auctions, manage team, settings |
| **Staff**  | Limited — view all data, record payments and cash entries only |
| **Superadmin** | Your master account — see all firms, change plans, suspend accounts |

---

## Pages

| Route | Description | Who |
|---|---|---|
| `/` | Public landing page with pricing | Everyone |
| `/register` | 2-step firm registration | New firms |
| `/login` | Sign in / sign up / forgot password | All users |
| `/onboarding` | Welcome wizard after registration | New owners |
| `/dashboard` | Stats, recent auctions, group progress | All |
| `/groups` | Create and manage chit groups | Owner |
| `/members` | Members with ticket dots, status, actions | Owner / Staff |
| `/auctions` | Record monthly auctions + auto dividend calc | Owner |
| `/payments` | Payment matrix with partial payment support | Owner / Staff |
| `/cashbook` | Daily denomination entry (₹2000, ₹500 … ₹1) | Owner / Staff |
| `/collection` | Printable pending collection report | Owner / Staff |
| `/reports` | Group and member summary reports | Owner / Staff |
| `/team` | Invite staff, manage roles | Owner |
| `/settings` | Account, theme, database info | Owner |
| `/invite/[id]` | Staff invite acceptance page | Invited staff |
| `/admin` | Super admin — all firms, plans, billing | Superadmin |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/chitvault.git
cd chitvault

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Database
# Paste supabase_schema_saas.sql into Supabase → SQL Editor → Run

# 5. Dev server
npm run dev
# Open http://localhost:3000
```

---

## First-Time Superadmin Setup

1. Register an account at `/register` (creates a firm — you can leave it as a test firm)
2. In Supabase SQL Editor, set yourself as superadmin:
```sql
update profiles set role = 'superadmin' where id = '<your-user-id>';
-- Find your id: select id, email from auth.users;
```
3. Sign out and sign back in → you'll land at `/admin`

---

## Database Schema

Tables and what they do:

```
firms           → registered businesses (name, slug, plan, status, trial_ends)
profiles        → auth users linked to firms + role (owner/staff/superadmin)
groups          → chit groups (firm_id, chit_value, duration, monthly_contribution)
members         → chit members (firm_id, group_id, ticket_no, status, contact_id)
auctions        → monthly auctions (firm_id, group_id, month, winner_id, dividend)
payments        → payment records (firm_id, partial support, balance_due, collected_by)
denominations   → daily cash entries (firm_id, note_2000…coin_1, computed total)
invites         → staff invite links (firm_id, email, role, expires_at)
```

**RLS rules (enforced at DB level):**
- `groups / members / auctions` — Staff can SELECT only; INSERT/UPDATE/DELETE requires owner role
- `payments / denominations` — Both owner and staff can INSERT
- All tables filtered by `my_firm_id()` helper function automatically

---

## Key Features

**Groups & Members**
- Create chit groups with value, duration, monthly contribution
- Add members across multiple groups (linked by `contact_id`)
- Ticket transfer, foreman absorption, defaulter tracking

**Auctions**
- Record winner + bid amount per month
- Auto-calculates discount, dividend per member
- Eligible bidder list (excludes previous winners)

**Payments — Partial Payment Support**
- Payment matrix: ✓ green = full, `65%` gold = partial, number = unpaid
- Click partial cell → history modal with all installments + progress bar
- "Pay Balance ₹X" button in history modal
- `payment_type` (full/partial), `balance_due`, `collected_by` tracked per entry

**Daily Cash Book**
- Staff enters denomination counts: ₹2000 × 5, ₹500 × 12 etc.
- Computed `total` stored in DB (generated column)
- Date range filter, expandable entries, printable

**Collection Report**
- Lists all pending and partial members with phone numbers
- Partial months marked with `M3 ~` (tilde indicator)
- Defaulters in separate section with notes

**Team Management**
- Owner invites staff via email
- Invite link sent → staff clicks → creates account → joins firm automatically
- 7-day invite expiry, revokable, role selectable (staff / owner)

**Billing (Manual)**
- Trial: 30 days free, 2 groups, 20 members
- Basic: ₹2,000/yr, 10 groups, 200 members
- Pro: ₹5,000/yr, unlimited
- Admin panel: change plan with dropdown → reflected instantly
- Suspend non-paying accounts → firm sees suspended screen

---

## Project Structure

```
chitvault-saas/
├── app/
│   ├── page.tsx              → Public landing page
│   ├── register/             → 2-step firm registration
│   ├── login/                → Auth page
│   ├── onboarding/           → Post-registration wizard
│   ├── invite/[id]/          → Staff invite accept
│   ├── admin/                → Superadmin dashboard
│   ├── dashboard/            → Stats + layout (shared by all pages below)
│   ├── groups/
│   ├── members/
│   ├── auctions/
│   ├── payments/
│   ├── cashbook/
│   ├── collection/
│   ├── reports/
│   ├── team/
│   └── settings/
├── components/
│   └── ui/                   → Badge, Btn, Card, Modal, Table, Toast, etc.
├── electron/
│   ├── main.js               → Electron entry (starts Next.js server)
│   ├── preload.js            → Secure renderer bridge
│   ├── loading.html          → Splash screen
│   ├── package.json          → electron-builder config
│   ├── LICENSE.txt
│   ├── ELECTRON_BUILD.md     → Desktop build guide
│   └── build/icon.ico
├── lib/
│   ├── firm/
│   │   ├── context.tsx       → FirmProvider (firm + profile + role + can())
│   │   ├── permissions.ts    → PERMISSIONS map + can() function
│   │   └── useFirmId.ts      → Hook for firm_id
│   ├── supabase/
│   │   ├── client.ts         → Browser Supabase client
│   │   └── server.ts         → Server Supabase client
│   └── utils/index.ts        → fmt(), fmtDate(), APP_NAME
├── types/index.ts            → All TypeScript interfaces
├── middleware.ts             → Auth guard + firm check + admin guard
├── supabase_schema_saas.sql  → Full DB schema with RLS
├── DEPLOYMENT.md             → Vercel deploy + domain setup guide
└── .env.example              → Environment variables template
```

---

## Git Workflow

```bash
# New feature
git checkout -b feat/sms-reminders
# ... make changes ...
git add .
git commit -m "feat: add WhatsApp payment reminders"
git push origin feat/sms-reminders
# Open Pull Request on GitHub → merge to main → Vercel auto-deploys

# Quick fix
git add .
git commit -m "fix: partial payment balance calculation"
git push
```

**Commit convention:**
- `feat:` — new feature
- `fix:` — bug fix
- `style:` — UI/CSS changes
- `refactor:` — code restructure
- `docs:` — documentation

---

## Deploy

```bash
npm install -g railway
railway login
railway up
```

See `DEPLOYMENT.md` for full instructions including custom domain setup.

---

## Desktop App (Electron)

```bash
# Build Windows .exe
npm run build:electron:win
# Output: electron/dist/ChitVault Setup 2.0.0.exe

# Test desktop app locally
npm run dev          # Terminal 1
npm run electron:dev # Terminal 2
```

See `electron/ELECTRON_BUILD.md` for full build guide.

---

## Adding a New Page

1. Create `app/your-page/page.tsx`
2. Create `app/your-page/layout.tsx` → `export { default } from '@/app/dashboard/layout'`
3. Add to sidebar in `app/dashboard/layout.tsx` (NAV array)
4. Add icon import from `lucide-react`
5. Add TypeScript types to `types/index.ts` if needed
6. Add RLS policy to `supabase_schema_saas.sql` if new table

---

## Useful Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Run production build locally
npm run type-check       # TypeScript checks
npm run lint             # ESLint
npm run build:electron   # Build Next.js in standalone mode (for Electron)
npm run build:electron:win  # Full Windows .exe build
npm run electron:dev     # Run Electron pointing at dev server
```
