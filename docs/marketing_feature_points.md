# ChitVault: Marketing Presentations (Layman Clients vs. Tech Team)

This document provides two ready-to-present slide layouts designed for different audiences:
1. **Client Pitch Deck (Layman / Business Focus)**
2. **Technical Pitch Deck (Developer / IT Focus)**

---

## 👥 Presentation 1: Client & Business Pitch Deck (Layman)

This deck focuses on **business efficiency, financial health, security, and trust**.

````carousel
# Slide 1: Welcome to ChitVault
### The Modern Digital Ledger for Auction Chit Funds (chitvault.in)

*   **The Problem**: Paper registers get lost. Excel sheets have math errors. Tracking down late payments is stressful.
*   **The Solution**: A clean, automated digital vault at **[chitvault.in](https://chitvault.in)** that organizes your members, calculates auctions instantly, and makes your daily cash reconciliation simple.
*   **Trust Factor**: Build deep trust with your members by offering clean, printable receipts and professional reports.

<!-- slide -->

# Slide 2: Core Concept - People vs. Members
### Managing Your Customer Network Effortlessly

*   **People (Registry)**: Register a client once (Name, Phone, Address) in your master contact list.
*   **Members (Tickets)**: Assign them to groups. If a client buys 3 tickets in a group, ChitVault tracks each ticket independently.
*   **Benefit**: Zero duplicate data. Search for a client and instantly see every group they are enrolled in and their active tickets.

<!-- slide -->

# Slide 3: Groups & Flexible Schemes
### Tailor Your Chit Funds to Your Business Rules

*   **Dividend Scheme**: Bidding discount is shared immediately to lower next month's payments for all active members.
*   **Accumulation Scheme**: Save bid discounts in a central pool for structured target payouts.
*   **Organizer Commission**: Pick from 4 methods (Flat rate, percentage of the pool, percentage of the bid discount, or percentage of payout).

<!-- slide -->

# Slide 4: Smart Collections at chitvault.in
### Get Paid on Time, Every Month

*   **Matrix Tracker**: See a visual grid of who paid, who paid partially, and who is pending.
*   **Flexible Payment Modes**: Log payments via Cash, UPI (GPay/PhonePe), or Bank Transfer for simple bank reconciliation.
*   **Defaulter Priority**: Auto-generated lists point collection agents to the most overdue accounts first.

<!-- slide -->

# Slide 5: Daily Cashbook & Safety Net
### Bulletproof Daily Reconciliation

*   **Daily Digital Cashbook**: An integrated denomination calculator (count ₹500 down to ₹1 notes) to verify physical cash drawer holdings.
*   **The Trash System**: Deletes are non-destructive! Any accidental group or member deletion can be restored with a single click within 90 days.
*   **Multi-branch Ready**: Keep your branches completely separate and assign staff to restricted roles.
````

---

## 💻 Presentation 2: Technical & Compliance Deck (Techy)

This deck focuses on **architecture, security, transactional integrity, and data models**.

````carousel
# Slide 1: System Overview (chitvault.in)
### Next.js & Supabase PostgreSQL Architecture

*   **Core URL**: Host landing, onboarding and operations unified under **[chitvault.in](https://chitvault.in)**.
*   **Core Framework**: Next.js 16 (App Router) + TypeScript (Strict Mode).
*   **Database**: Supabase PostgreSQL with highly normalized structures.
*   **Client Target**: Multi-device web application and a dedicated cross-platform desktop installer packaged with **Electron**.
*   **Scope**: Specialized digital ledger with no external payment gateway dependencies.

<!-- slide -->

# Slide 2: Entity Relationship & Relational Model
### Clean Separation of Identity and Enrollment

*   **`persons`**: Central table containing real-world identities, enforced unique by `(firm_id, name, phone)`.
*   **`members`**: Joins `persons` to `groups`, representing distinct tickets. Enforced unique ticket assignment via `(group_id, ticket_no)`.
*   **`auctions`**: Tracks bidding transactions, payouts, and foreman commission logs.
*   **`payments`**: Handles ledger entries including partial payments, mapping `amount_due` and `balance_due`.

<!-- slide -->

# Slide 3: Multi-Tenancy & Routing at chitvault.in
### Enterprise-Grade Row Level Security (RLS)

*   **Single-Domain Routing**: All clients log in directly at `chitvault.in/login`. No subdomains are required.
*   **SaaS Data Isolation**: Enforced directly at the PostgreSQL layer using RLS policies.
*   **Access Query**: Every select/insert/update query checks:
    ```sql
    WHERE tenant_id = my_firm_id()
    ```
*   **RBAC Claims**: User accounts are tagged with roles (`superadmin`, `owner`, `staff`) inside `profiles` metadata, validated in middleware to control interface access.

<!-- slide -->

# Slide 4: The Mathematical Auction Engine
### Calculating Dividends & Commissions Safely

*   **dividend**: Computed on auction confirmation:
    ```
    dividend = (auction_discount - foreman_commission) / active_member_count
    ```
*   **payouts**: PERSISTED net payout logs on auction settlement to prevent retroactive calculation shifts:
    ```
    net_payout = winning_bid - foreman_commission
    ```
*   **Safety Limits**: SQL table constraints (`groups_comm_limit_chk`) prevent organizers from registering commission rates greater than 5% of chit value.

<!-- slide -->

# Slide 5: Resilience & Auditing
### Soft Deletions and Cashbook Reconciler

*   **Soft Deletion**: All major tables include a nullable `deleted_at` timestamp. RLS views filter active records; deleted records are purgeable after 90 days.
*   **Reconciler Math**:
    ```
    Closing Balance = (Previous Close) + (UPI + Bank + Cash Collections) - (Cash Settlements)
    ```
*   **Denomination Storage**: Denomination breakdowns are stored as structured JSON payloads mapped to `daily_cashbook` for audit traceability.
````
