# Financial Logic Documentation

This document explains how the ChitVault platform calculates auctions, commissions, and member dividends.

## 1. Auction Schemes

The platform supports two primary auction models:

### A. Normal Auction (The "Winning Bid" is the Payout)
*   **Winner's Payout**: The amount the winner bid (e.g., if a ₹100,000 chit is won at ₹80,000, the winner gets ₹80,000).
*   **Discount**: The difference between the full chit value and the winning bid (₹20,000).
*   **Dividend**: The **Discount** (minus commission) is shared among all active members, reducing their next monthly payment.

### B. Accumulation Scheme
*   **Winner's Payout**: The total chit value minus the bid (e.g., if won at ₹5,000 bid, winner gets ₹95,000).
*   **Surplus Pool**: The bid amount (₹5,000) is added to the group's **Accumulated Surplus**.
*   **Dividend**: No immediate dividend is paid. The surplus stays in the firm's pool until the end or for target payouts.

---

## 2. Commission Logic

Foreman commission is deducted from the winner's payout before they receive the funds. It can be configured in four ways:

| Type | Calculation |
| :--- | :--- |
| **Percentage of Chit** | % of the total group value (e.g., 5% of ₹1L = ₹5,000) |
| **Percentage of Discount** | % of the auction discount (e.g., 10% of ₹20k = ₹2,000) |
| **Percentage of Payout** | % of the winner's take-home (e.g., 2% of ₹80k = ₹1,600) |
| **Fixed Amount** | A flat ₹ amount specified at group level |

---

## 3. Member Collections

The amount a member pays each month is calculated as:

> **Monthly Payment = (Base Contribution) - (Dividend)**

*   **Base Contribution**: `Chit Value / Duration`.
*   **Dividend**: `(Discount - Commission) / Total Members`.

---

## 4. Example Calculation (Normal Scheme)

**Group Setup:**
*   Chit Value: ₹100,000
*   Duration: 20 Months
*   Base Contribution: ₹5,000
*   Commission: 5% of Chit (₹5,000)

**Auction Result (Month 2):**
*   Winning Bid: ₹80,000
*   Discount: ₹20,000 (100k - 80k)

**Final Figures:**
1.  **Firm Commission**: ₹5,000
2.  **Winner's Net Payout**: ₹75,000 (₹80k bid - ₹5k comm)
3.  **Total Dividend Pool**: ₹15,000 (₹20k discount - ₹5k comm)
4.  **Per Member Dividend**: ₹750 (₹15,000 / 20 members)
5.  **Each Member Pays**: **₹4,250** (₹5,000 base - ₹750 div)
