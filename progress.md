# ChitVault Progress & Changelog

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
  - Utilizes `getWhatsAppLink()` with automatic Indian country code prefixing (`+91`) and zero-cost, serverless dispatch.
