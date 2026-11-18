# ChitVault Progress & Changelog

## [3.3.0] - 2026-11-18

### Overview of Version 3.3.0 Release

#### 7. WhatsApp (`wa.me`) Instant Payment Receipts & Audit Sharing
- **Feature**: Integrated instant WhatsApp payment receipts following the pattern used in PledgeVault.
- **Implementation**:
  - **Record Collection Success Modal (`RecordCollectionModal.tsx`)**: Added a prominent **"Send WhatsApp Receipt"** button right after recording a payment, pre-formatting a professional receipt with firm name, member name, amount received, payment mode, applied installments, and date (`dd-MMM-yyyy`).
  - **Payment Audit Table (`/collection`)**: Added a quick WhatsApp icon button next to the Print button on each payment entry so cashiers can re-send payment confirmations at any time.
  - **Centralized Phone Normalization (`normalizePhone`)**: Created `normalizePhone()` in `lib/utils/index.ts` to ensure phone numbers always have country code prefixes (`91` for India) and clean out leading zeroes, spaces, and punctuation across all WhatsApp triggers (`RecordCollectionModal`, `/collection`, and `/defaulters`).

#### 8. Phone Number Strict 10-Digit Validation
- **Problem**: Previously, incomplete phone numbers (e.g., 5 or 7 digits) could be submitted, leading to invalid WhatsApp links and broken communication.
- **Fix**:
  - **Utility Level (`lib/utils/index.ts`)**: Added `isValidPhone()` and updated `normalizePhone()` so numbers with fewer than 10 digits are treated as invalid/empty instead of generating broken `wa.me` URLs.
  - **Registration & Enrollment Modals**:
    - `AddMemberModal.tsx` & `/groups/[id]/page.tsx`: Added `maxLength={10}`, digit filtering, and exact 10-digit validation on submission.
    - `/members/page.tsx` (Person Registration): Added exact 10-digit validation (`/^\d{10}$/`).
    - `/members/[id]/page.tsx` (Profile Edit Modal): Added `maxLength={10}` and exact 10-digit validation before saving.
    - `/settings/page.tsx` (Support Phone): Added exact 10-digit validation on firm profile update.

#### 9. Modern Public Landing Page & Self-Serve "Start Trial" Flow
- **Feature**: Added a public-facing product landing page and automated 30-day free trial enrollment.
- **Implementation**:
  - **Public Landing Page (`app/page.tsx`)**: Built a modern dark-mode landing page highlighting ChitVault's core capabilities (Automated Auction Ledger, Instant WhatsApp Receipts, Risk Radar, and Audit Prints). Automatically redirects authenticated users straight to `/dashboard`.
  - **Self-Serve Trial Wizard (`app/start-trial/page.tsx`)**: Created a 2-step onboarding wizard (Chit Firm Details &rarr; Admin Account Setup) with instant 30-day trial activation via `startTrialAction`. Includes mandatory agreement checkbox linked to legal documents (`/legal/terms` & `/legal/privacy`).
  - **Server Action (`app/actions/start-trial.ts`)**: Initializes the new firm with `plan: 'trial'`, sets `trial_ends` to +30 days, generates a unique firm slug, registers the owner account, and links their profile. Also provides a one-click WhatsApp demo booking link.

#### 10. SEO Optimization, Dynamic Robots & Sitemap
- **Feature**: Full search engine indexing setup and crawler controls.
- **Implementation**:
  - **Dynamic `robots.ts` (`app/robots.ts`)**: Instructs search engines to index public pages (`/`, `/start-trial`, `/plans`, `/legal/*`) while strictly blocking internal firm data, admin routes, member passbooks, collection workspaces, and auction logs (`/admin/`, `/superadmin/`, `/groups/`, `/members/`, `/collection/`).
  - **Dynamic `sitemap.ts` (`app/sitemap.ts`)**: Automatically generates an XML sitemap with change frequencies and priorities for Google, Bing, etc.
  - **Enhanced Meta Tags (`app/layout.tsx`)**: Configured OpenGraph, Twitter Cards, rich title templates, targeted Indian chit fund keywords, and canonical metadataBase.

#### 11. Standardized Version & Subsidiary Credit Footers
- **Feature**: Standardized corporate credits, subsidiary acknowledgment, and version format matching the NDT Exchange / Seyon Nexa Labs standard.
- **Format**:
  `© {currentYear} CHITVAULT. Developed by SEYON NEXA LABS (A subsidiary of NVISION SYSTEMS) • v{APP_VERSION} ({APP_COMMIT_ID})`.
- **Applied In**:
  - Landing Page footer (`app/page.tsx`)
  - Start Trial wizard footer (`app/start-trial/page.tsx`)
  - Internal Sidebar (`app/(internal)/layout.tsx`)
  - Firm Passport Badge & System Status (`app/(internal)/settings/page.tsx`)

#### 12. Product Branding & Identity Cleanup ("Silenced Seyon")
- **Refinement**: Standardized user-facing product branding strictly to **ChitVault** (single word, no prefix or space) while preserving "Seyon Nexa Labs" exclusively for developer credits and corporate attribution lines.
- **Changes**:
  - `app/onboarding/page.tsx`: Changed welcome header from `Welcome to Seyon ChitVault!` to `Welcome to ChitVault!`.
  - `electron/package.json`: Updated `productName`, `description`, `copyright`, `publisherName`, and `shortcutName` to remove "Seyon" prefix. Corporate authorship (`Seyon Nexa Labs`) remains intact.
  - `electron/loading.html`: Updated splash logo from `Seyon ChitVault` to `ChitVault`.
  - `app/(internal)/help/page.tsx`: Updated footer from `Powered by Seyon Nexa Labs • Ultimate Help Book Edition` to `Powered by ChitVault Platform • Ultimate Help Book Edition`.

---

## [3.2.0] - 2026-11-13

### Comprehensive Overview of Changes

#### 1. Auction Calendar Alignment & Date Fix

- **Problem**: In the Auction Ledger and related views, month labels were calculated strictly from `group.start_date` regardless of when the auction actually took place (e.g., displaying `M1 (Mar-26)` even when the auction was held on `06 Apr 2026`).
- **Fix**:
  - Enhanced `fmtMonth()` in `lib/utils/index.ts` to accept an optional `actualDate` (e.g., `auction_date`).
  - When an auction has a recorded date, the month label dynamically aligns with the actual auction date (`M1 (Apr-26)`).
  - Draft and unconfirmed projections gracefully fall back to projecting from `group.start_date`.
  - Applied across `AuctionLedger.tsx`, `auctions/page.tsx`, `ReportWinners.tsx`, `MemberDirectory.tsx` (won month badge), `MemberLedger.tsx` (statement month list), and `StreakBar.tsx` (hover tooltip).

#### 2. Group Settings Financial Lock Refinement

- **Problem**: When a group had confirmed auctions, the entire financial block including `start_date` was disabled, preventing operators from correcting mistaken start months or misconfigured launch dates.
- **Fix**:
  - Updated `app/(internal)/groups/[id]/settings/page.tsx` so `start_date` and `name` remain editable after auctions begin.
  - Kept critical financial invariant fields locked (`chit_value`, `monthly_contribution`, and `duration`) to preserve ledger consistency and payout integrity.
  - Added a live formatted `dd-MMM-yyyy` preview badge next to the Start Date picker to eliminate browser locale ambiguity (`MM/DD/YYYY` vs `DD/MM/YYYY`).

#### 3. Standardized Date Format to `dd-MMM-yyyy`

- **Problem**: Dates across the application had varying formats (some with spaces, or browser-locale-dependent slashes).
- **Fix**:
  - Standardized `fmtDate()` in `lib/utils/index.ts` to strictly output `dd-MMM-yyyy` (e.g., `06-Apr-2026`).
  - Standardized `fmtDateTime()` to output `dd-MMM-yyyy, hh:mm AM/PM`.
  - Propagates automatically across all tables, modal summaries, vouchers, and print templates.

#### 4. Interactive "Sync Historical Ledger" Console

- **Problem**: Clicking "Sync Historical Ledger" previously triggered a generic browser alert and silent RPC execution without visibility into which auctions were processed or what changed.
- **Fix**:
  - Built an interactive **Ledger Sync Console** modal in `app/(internal)/groups/[id]/settings/page.tsx`.
  - Streams real-time timestamped audit logs: active calculation rules, total confirmed auctions fetched, individual ticket winners and gross discounts.
  - Verifies and outputs updated per-member dividends and net payouts after database RPC execution.
  - Added a **Copy Log** button for audits and clean status indicators (`Synchronizing...`, `Complete ✓`).

#### 5. Enhanced Streak Indicator (Auction Recorded vs. Pending)

- **Problem**: The Streak column in Member Directory and Defaulters previously only showed payment dots without indicating whether an auction for that month had actually taken place.
- **Fix**:
  - Created reusable `<StreakBar />` component (`components/features/StreakBar.tsx`).
  - Added visual distinction between **Auctions Recorded** (solid bars with top indicator dot) vs. **Auctions Pending** (dashed/hollow border for current/future cycles).
  - Added rich interactive tooltips showing Month (`M1 (Apr-26)`), Auction status (Recorded with Winner name vs Pending), and member payment status (Paid, Unpaid, or Advance).
  - Integrated across Member Directory (`/groups/[id]`) and Defaulters dashboard (`/defaulters`).

#### 6. Version Bump & Zero-Env Versioning

- **Problem**: `APP_VERSION` and `APP_COMMIT_ID` previously fell back to or read from `.env` (`NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_COMMIT_ID`), which caused stale versions or required manual env syncing.
- **Fix**:
  - Bumped application minor version to **`3.2.0`** across `package.json` and `lib/utils/index.ts`.
  - Disconnected `APP_VERSION` from `.env`; it is now declared directly in code as `'3.2.0'`.
  - Created automated build script `scripts/generate-version.js` that pulls `git rev-parse --short HEAD` directly from Git and writes to `lib/version.json`.
  - Hooked script into `predev`, `prebuild`, and `postinstall` in `package.json`.
  - In `lib/utils/index.ts`, `APP_COMMIT_ID` imports `versionInfo.commit` directly—zero hardcoding, zero `process.env` dependency.

#### 7. WhatsApp (`wa.me`) Instant Payment Receipts & Audit Sharing
- **Feature**: Integrated instant WhatsApp payment receipts following the pattern used in PledgeVault.
- **Implementation**:
  - **Record Collection Success Modal (`RecordCollectionModal.tsx`)**: Added a prominent **"Send WhatsApp Receipt"** button right after recording a payment, pre-formatting a professional receipt with firm name, member name, amount received, payment mode, applied installments, and date (`dd-MMM-yyyy`).
  - **Payment Audit Table (`/collection`)**: Added a quick WhatsApp icon button next to the Print button on each payment entry so cashiers can re-send payment confirmations at any time.
  - **Centralized Phone Normalization (`normalizePhone`)**: Created `normalizePhone()` in `lib/utils/index.ts` to ensure phone numbers always have country code prefixes (`91` for India) and clean out leading zeroes, spaces, and punctuation across all WhatsApp triggers (`RecordCollectionModal`, `/collection`, and `/defaulters`).

#### 8. Phone Number Strict 10-Digit Validation
- **Problem**: Previously, incomplete phone numbers (e.g., 5 or 7 digits) could be submitted, leading to invalid WhatsApp links and broken communication.
- **Fix**:
  - **Utility Level (`lib/utils/index.ts`)**: Added `isValidPhone()` and updated `normalizePhone()` so numbers with fewer than 10 digits are treated as invalid/empty instead of generating broken `wa.me` URLs.
  - **Registration & Enrollment Modals**:
    - `AddMemberModal.tsx` & `/groups/[id]/page.tsx`: Added `maxLength={10}`, digit filtering, and exact 10-digit validation on submission.
    - `/members/page.tsx` (Person Registration): Added exact 10-digit validation (`/^\d{10}$/`).
    - `/members/[id]/page.tsx` (Profile Edit Modal): Added `maxLength={10}` and exact 10-digit validation before saving.
    - `/settings/page.tsx` (Support Phone): Added exact 10-digit validation on firm profile update.

#### 9. Modern Public Landing Page & Self-Serve "Start Trial" Flow
- **Feature**: Added a public-facing product landing page and automated 30-day free trial enrollment.
- **Implementation**:
  - **Public Landing Page (`app/page.tsx`)**: Built a modern dark-mode landing page highlighting ChitVault's core capabilities (Automated Auction Ledger, Instant WhatsApp Receipts, Risk Radar, and Audit Prints). Automatically redirects authenticated users straight to `/dashboard`.
  - **Self-Serve Trial Wizard (`app/start-trial/page.tsx`)**: Created a 2-step onboarding wizard (Chit Firm Details &rarr; Admin Account Setup) with instant 30-day trial activation via `startTrialAction`. Includes mandatory agreement checkbox linked to legal documents (`/legal/terms` & `/legal/privacy`).
  - **Server Action (`app/actions/start-trial.ts`)**: Initializes the new firm with `plan: 'trial'`, sets `trial_ends` to +30 days, generates a unique firm slug, registers the owner account, and links their profile. Also provides a one-click WhatsApp demo booking link.

#### 10. SEO Optimization, Dynamic Robots & Sitemap
- **Feature**: Full search engine indexing setup and crawler controls.
- **Implementation**:
  - **Dynamic `robots.ts` (`app/robots.ts`)**: Instructs search engines to index public pages (`/`, `/start-trial`, `/plans`, `/legal/*`) while strictly blocking internal firm data, admin routes, member passbooks, collection workspaces, and auction logs (`/admin/`, `/superadmin/`, `/groups/`, `/members/`, `/collection/`).
  - **Dynamic `sitemap.ts` (`app/sitemap.ts`)**: Automatically generates an XML sitemap with change frequencies and priorities for Google, Bing, etc.
  - **Enhanced Meta Tags (`app/layout.tsx`)**: Configured OpenGraph, Twitter Cards, rich title templates, targeted Indian chit fund keywords, and canonical metadataBase.

#### 11. Standardized Version & Subsidiary Credit Footers
- **Feature**: Standardized corporate credits, subsidiary acknowledgment, and version format matching the NDT Exchange / Seyon Nexa Labs standard.
- **Format**:
  `© {currentYear} CHITVAULT. Developed by SEYON NEXA LABS (A subsidiary of NVISION SYSTEMS) • v{APP_VERSION} ({APP_COMMIT_ID})`.
- **Applied In**:
  - Landing Page footer (`app/page.tsx`)
  - Start Trial wizard footer (`app/start-trial/page.tsx`)
  - Internal Sidebar (`app/(internal)/layout.tsx`)
  - Firm Passport Badge & System Status (`app/(internal)/settings/page.tsx`)

#### 12. Product Branding & Identity Cleanup ("Silenced Seyon")
- **Refinement**: Standardized user-facing product branding strictly to **ChitVault** (single word, no prefix or space) while preserving "Seyon Nexa Labs" exclusively for developer credits and corporate attribution lines.
- **Changes**:
  - `app/onboarding/page.tsx`: Changed welcome header from `Welcome to Seyon ChitVault!` to `Welcome to ChitVault!`.
  - `electron/package.json`: Updated `productName`, `description`, `copyright`, `publisherName`, and `shortcutName` to remove "Seyon" prefix. Corporate authorship (`Seyon Nexa Labs`) remains intact.
  - `electron/loading.html`: Updated splash logo from `Seyon ChitVault` to `ChitVault`.
  - `app/(internal)/help/page.tsx`: Updated footer from `Powered by Seyon Nexa Labs • Ultimate Help Book Edition` to `Powered by ChitVault Platform • Ultimate Help Book Edition`.
