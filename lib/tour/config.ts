import { TourStep } from '@/components/ui/Tour'

export const PATH_TO_TOUR: Record<string, TourStep[]> = {
  '/dashboard': [
    { target: '#tour-welcome', title: 'Modernized Citadel', content: "Welcome to the new ChitVault Core. We've overhauled the interface for maximum speed and financial clarity.", nextLabel: 'Initiate Link' },
    { target: '#tour-stats', title: 'Real-Time Intelligence', content: "Track your firm's pulse with live metrics. From daily collections to critical defaulter alerts, everything is one click away.", nextLabel: 'Analyze Trends' },
    { target: '#tour-analytics', title: 'Visual Financials', content: "Identify trends at a glance. Our high-fidelity charts help you predict capital flow and group distribution.", nextLabel: 'Master Control' },
    { target: '#tour-sidebar', title: 'Command Center', content: "The new Sidebar is your cockpit. Use Ctrl+K from anywhere to teleport between modules instantly.", nextLabel: 'Finish Protocol' },
  ],
  '/members': [
    { target: '#tour-member-title', title: 'Registry Hub', content: "Manage your entire member base here. We've optimized this view for both individual and group-based auditing.", nextLabel: 'Switch Views' },
    { target: '#tour-member-views', title: 'Dynamic Perspectives', content: "Teleport between 'All People' for a unified directory and 'By Groups' for operational management.", nextLabel: 'Search Assets' },
    { target: '#tour-member-search', title: 'Deep Search', content: "Instantly find members by name, phone, or ticket number. Speed is survival.", nextLabel: 'Enrollment' },
    { target: '#tour-member-add', title: 'Rapid Enrollment', content: "Enroll new members in seconds. Link them to existing groups or create new people in one flow.", nextLabel: 'Finish' },
  ],
  '/groups': [
    { target: '#tour-group-list', title: 'Chit Schemes', content: "Monitor every group's progress. Use the visual bars to track how close each group is to completion.", nextLabel: 'New Scheme' },
    { target: '#tour-group-add', title: 'Architect New Groups', content: "Launch new Dividend or Accumulation schemes. Set durations, chit values, and contribution rules here.", nextLabel: 'Group Pulse' },
    { target: '#tour-group-card', title: 'Operational Health', content: "Each card shows real-time progress and outstanding balances for the entire group.", nextLabel: 'Finish' },
  ],
  '/auctions': [
    { target: '#tour-auction-title', title: 'Auction Theater', content: "The heartbeat of your firm. Schedule and record monthly bidding sessions here.", nextLabel: 'Record Signal' },
    { target: '#tour-auction-add', title: 'Commence Bidding', content: "Record winners, calculate dividends, and finalize monthly prize money logic with one click.", nextLabel: 'Audit History' },
    { target: '#tour-auction-list', title: 'Audit Trail', content: "View historical auction results to ensure absolute financial transparency.", nextLabel: 'Finish' },
  ],
  '/collection': [
    { target: '#tour-coll-stat', title: 'Field Statistics', content: "Real-time view of daily dues and collection performance for your field agents.", nextLabel: 'Rapid Search' },
    { target: '#tour-coll-search', title: 'Agent Search', content: "Agents can quickly find members in the field and see their total outstanding across all groups.", nextLabel: 'One-Tap Payment' },
    { target: '#tour-coll-pay', title: 'One-Tap Payments', content: "Record payments instantly. No complex forms—just pure field efficiency.", nextLabel: 'Finish' },
  ],
  '/payments': [
    { target: '#tour-pay-title', title: 'Ledger Audit', content: "A comprehensive history of every transaction recorded across your firm.", nextLabel: 'Filters' },
    { target: '#tour-pay-filter', title: 'Financial Filters', content: "Filter by mode, date, or member to perform deep-dive financial audits.", nextLabel: 'Manual Entry' },
    { target: '#tour-pay-add', title: 'Ad-hoc Registry', content: "Manually record payments for specialized cases or walk-in customers.", nextLabel: 'Finish' },
  ],
  '/settlement': [
    { target: '#tour-settle-title', title: 'Capital Payouts', content: "Manage the final stage of the auction cycle: paying out prize money to winners.", nextLabel: 'Verify Dues' },
    { target: '#tour-settle-list', title: 'Payable Registry', content: "Only members who have cleared their dues and are ready for payout appear here.", nextLabel: 'Execute Payout' },
    { target: '#tour-settle-btn', title: 'Secure Payout', content: "Audit-grade payout execution. Capture notes and finalize the transaction for the ledger.", nextLabel: 'Finish' },
  ]
}
