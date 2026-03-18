# ChitVault — Next.js Edition

Auction Chit Fund Management Software built with **Next.js 14**, **Supabase** and **TypeScript**.

---

## Stack

| Layer       | Technology               |
|-------------|--------------------------|
| Framework   | Next.js 14 (App Router)  |
| Database    | Supabase (PostgreSQL)    |
| Auth        | Supabase Auth            |
| Styling     | Tailwind CSS + CSS Vars  |
| Language    | TypeScript               |
| Deployment  | Vercel (free)            |

---

## Local Setup (First Time)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/chitvault.git
cd chitvault
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_APP_NAME=ChitVault
```

### 4. Set up Supabase database
- Go to [supabase.com](https://supabase.com) → SQL Editor
- Run `supabase_schema.sql`
- Run the migration SQL to add new columns if upgrading

### 5. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Git Workflow (Daily Development)

### Starting a new feature
```bash
git checkout -b feature/payment-reminders
# ... make changes ...
git add .
git commit -m "feat: add WhatsApp payment reminders"
git push origin feature/payment-reminders
# Open Pull Request on GitHub
```

### Committing a fix
```bash
git add .
git commit -m "fix: collection report excluding exited members"
git push
```

### Commit message convention
```
feat:  new feature
fix:   bug fix
style: UI changes
refactor: code cleanup
docs:  documentation
```

---

## Deploy to Vercel (Free)

### One-time setup
```bash
npm install -g vercel
vercel login
vercel
```

### Per-client deployment
```bash
# Set env vars in Vercel dashboard for the project
# Or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_APP_NAME

vercel --prod
```

Each client gets their own Vercel project + Supabase project.

### Auto-deploy on push
Connect your GitHub repo in Vercel dashboard → every push to `main` auto-deploys.

---

## Per-Client Setup Process

1. **Create Supabase project** for client → run `supabase_schema.sql`
2. **Fork or duplicate** this repo on GitHub → name it `chitvault-clientname`
3. **Create Vercel project** → link to the repo → add client's env vars
4. **Set `NEXT_PUBLIC_APP_NAME`** to client's business name
5. **Deploy** → share the `.vercel.app` URL with client

---

## Project Structure

```
chitvault-next/
├── app/
│   ├── login/          # Sign in / sign up / forgot password
│   ├── dashboard/      # Main dashboard + shared layout
│   ├── groups/         # Chit group management
│   ├── members/        # Member management
│   ├── auctions/       # Auction recording
│   ├── payments/       # Payment matrix
│   ├── reports/        # Summary reports
│   ├── collection/     # Collection report (printable)
│   └── settings/       # Account & appearance
├── components/
│   └── ui/             # Reusable UI components
├── lib/
│   ├── supabase/       # Browser & server clients
│   ├── hooks/          # useToast, etc.
│   └── utils/          # fmt, fmtDate, helpers
├── types/              # TypeScript interfaces
├── middleware.ts        # Auth protection
└── .env.example        # Environment template
```

---

## Adding a New Feature

1. Create page in `app/feature-name/page.tsx`
2. Add route to sidebar in `app/dashboard/layout.tsx`
3. Add TypeScript types in `types/index.ts` if needed
4. Commit and push

---

## Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run type-check   # Check TypeScript errors
npm run lint         # Run ESLint
```
