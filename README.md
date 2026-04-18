# ChitVault

**Professional Digital Ledger for Auction Chit Fund Management** — A modern, multi-tenant SaaS platform built for transparency, accuracy, and absolute auditing integrity.

> [!IMPORTANT]
> **Financial Scope**: ChitVault is a specialized **Digital Ledger** for record-keeping and auditing. It does **not** handle actual bank transfers or financial transactions. All payments mentioned within the app are manual records of external transactions.

---

## 🚀 Key Value Propositions

- **Mathematical Integrity**: Automated dividend and commission calculations based on real-world auction models.
- **Multi-Tenant Architecture**: Robust data isolation for multiple firms, each with its own branding and data silo.
- **Audit-Ready**: Comprehensive activity logs, secure auction recording, and printable financial vouchers.
- **Zero-Friction Operations**: Streamlined collection centers, daily cashbook reconciliation, and defaulter tracking.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Backend** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (Unified Identity) |
| **Styles** | Vanilla CSS + Tailwind Core |
| **Logic** | TypeScript (Strict Mode) |
| **Desktop** | Electron (Cross-platform builds) |

---

## 🏗️ Core Financial Modules

### 1. Advanced Auction Engine
Supports two distinct auction methodologies out of the box:
- **Dividend (Conventional)**: Members bid for the pot; the discount is distributed among fellow members.
- **Accumulation (Fixed Payout)**: A structured model focused on fixed payouts with accumulated surplus tracking.

### 2. Market Debt & Analytics
Real-time visibility into the financial health of your firm:
- **Market Debt**: Total liabilities from paid auctions.
- **Life Time Paid**: Cumulative member contributions.
- **Arrears Tracking**: Priority lists for members with outstanding dues.

### 3. Smart Collection Center
- Matrix-style payment tracking with support for partial installments.
- Visual indicators for payment status (Full, Partial, Pending).
- External payment mode labels (Cash, UPI, Bank Transfer) for internal reconciliation.

### 4. Daily Digital Cashbook
- Precision reconciliation of physical cash holdings.
- Denomination-based tracking (₹2000 down to ₹1).
- Automated daily totals and printable audit logs.

---

## 🔐 Security & Architecture

### Multi-Tenancy (SaaS)
ChitVault utilizes a secure, single-domain multi-tenant architecture. Data isolation is enforced at the database level using **PostgreSQL Row Level Security (RLS)**. 
- A custom `my_firm_id()` function ensures that users can *never* access data from another firm.
- Middleware handles routing based on user roles and firm affiliation.

### Role-Based Access Control (RBAC)
- **Superadmin**: Global oversight, firm management, and plan configuration.
- **Owner**: Full administrative control over a specific firm, its groups, and its team.
- **Staff**: Operational access restricted to data entry and record-keeping.

---

## 📦 Getting Started (Developers)

### Prerequisites
- Node.js (v20+)
- Supabase account & project

### Setup Instructions
```bash
# 1. Clone the repository
git clone https://github.com/seyon-nexa-labs/chitvault.git
cd chitvault

# 2. Install dependencies
npm install

# 3. Configure Environment
cp .env.example .env.local
# Update with your Supabase URL and Anon Key

# 4. Initialize Database
# Execute the contents of 'supabase_schema_saas.sql' in your Supabase SQL Editor.

# 5. Run Development Server
npm run dev
```

---

## 🖥️ Desktop Distribution (Electron)

ChitVault can be packaged as a professional Windows/MacOS desktop application.

```bash
# Build for Windows
npm run build:electron:win

# Local Testing
npm run dev           # Terminal 1
npm run electron:dev  # Terminal 2
```
*See `electron/ELECTRON_BUILD.md` for detailed build configurations.*

---

## 📂 Project Organization

```text
├── app/              # Next.js App Router (Internal & Auth routes)
├── components/       # Premium UI components and complex modals
├── lib/              # Context Providers, Supabase clients, and utilities
├── types/            # Centralized TypeScript definitions
├── electron/         # Desktop application source and build assets
└── sql/              # (Reference) Supabase schema and RPC definitions
```

---

## 🛡️ Non-Destructive Operations
The platform includes a **Trash System** that protects against accidental data loss. Deleted groups or members are moved to a temporary state and can be recovered within a 90-day grace period before permanent removal.

---

## 🤝 Contribution & Standards
- **Commit Pattern**: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`.
- **Styling**: Adhere to the established CSS variables and design tokens for UI consistency.
- **Versioning**: All releases follow Semantic Versioning (SemVer).

---

© 2026 **Foundation Finance Systems**. All Rights Reserved.
