# Privacy & Data Protection Policy

**Last Updated**: January 1, 2026

## 1. Introduction
This policy describes how ChitVault handles and protects the sensitive data of Finance Firms ("Firms") and their individual members ("Subscribers"). 

## 2. Multi-Tenant Data Isolation
ChitVault is built on a multi-tenant architecture designed to ensure that each Firm’s data is strictly isolated.
- **Silo Enforcement**: Data is filtered by a mandatory `firm_id` at the database level (Row Level Security).
- **Unauthorized Access**: Users from Firm A can never view, search, or interact with data belonging to Firm B.

## 3. Data Processing Roles
- **Data Controller**: The Finance Firm (The Client) is the "Data Controller" and owns all data entered into the platform.
- **Data Processor**: NVision Systems (Finance & Tech) acts as the "Data Processor," providing the infrastructure and tools to manage the Client's data securely.

## 4. No Member KYC Collection
ChitVault is a digital bookkeeping tool and does not require or collect official Know Your Customer (KYC) documentation for individual members.
- ID proofs (Aadhaar, PAN, Passport, etc.) should **never** be uploaded to the platform.
- Member identification within the app is limited to basic contact markers (Name, Phone number) for ledger management purposes only.
- Maintaining physical or digital KYC documentation remains the sole responsibility of the Firm Owner outside of the ChitVault ecosystem.

## 5. Member Information (Privacy)
Firms enter member details (Name, Phone, Address) into the platform for ledger management.
- **Ownership**: The Firm owns the data it enters. ChitVault acts as a processor of this data.
- **Minimum Data Disclosure**: We recommend firms only enter information necessary for financial record-keeping.
- **Usage**: Member contact information is used exclusively for firm-level communication (e.g., payment reminders) and is never shared with third parties.

## 4. User Access Controls (RBAC)
The platform enforces strict Role-Based Access Control:
- **Owners**: Full visibility and administrative control over firm data.
- **Staff**: Operational access restricted to data entry (Payments, Cashbook) and viewing directories. Sensitive settings and deletions are restricted.

## 5. Session Security
- **Auth Syncing**: Sessions are managed securely via Supabase Auth.
- **PIN Lock**: Users can enable an optional PIN lock to protect their active session from unauthorized local access.

## 6. Data Recovery & Retention
- **Trash System**: Deleted groups or members are held in a "Trash" state for 90 days. This allows for recovery in case of accidental deletion.
- **Permanent Deletion**: After 90 days, data is permanently scrubbed from our active databases.

## 7. Security Standards
Data is stored in industry-standard encrypted databases provided by Supabase (PostgreSQL). Communications between your browser and our servers are encrypted via HTTPS (SSL/TLS).

---
© 2026 **NVision Systems (Finance & Tech)**
