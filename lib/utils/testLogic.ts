
import { getMemberFinancialStatus } from './chitLogic';

const mockGroup = {
    id: 1,
    auction_scheme: 'ACCUMULATION',
    duration: 20,
    monthly_contribution: 5000,
    start_date: '2026-01-01',
    status: 'active'
};

const mockMember = {
    id: 101,
    person_id: 1,
    group_id: 1,
    ticket_no: 1,
    status: 'active'
};

// 1 Confirmed Auction (Month 1)
const mockAuctions = [
    { id: 10, group_id: 1, month: 1, status: 'confirmed', dividend: 0 }
];

// 1 Payment for Month 1
const mockPayments = [
    { id: 1001, member_id: 101, group_id: 1, month: 1, amount: 5000, status: 'paid' }
];

const result = getMemberFinancialStatus(mockMember as any, mockGroup as any, mockAuctions as any, mockPayments as any);

console.log('--- ACCUMULATION TEST (1 CONFIRMED AUC + 1 PAYMENT) ---');
console.log('Balance:', result.balance);
console.log('Total Due:', result.totalDue);
console.log('Total Paid:', result.totalPaid);
console.log('Missed Count:', result.missedCount);
console.log('Status M2:', result.streak.find(s => s.month === 2)?.status);

// Test with 0 payments
const result2 = getMemberFinancialStatus(mockMember as any, mockGroup as any, mockAuctions as any, []);
console.log('\n--- ACCUMULATION TEST (1 CONFIRMED AUC + 0 PAYMENTS) ---');
console.log('Balance:', result2.balance);

// Test with 2 confirmed auctions
const mockAuctions2 = [
    { id: 10, group_id: 1, month: 1, status: 'confirmed', dividend: 0 },
    { id: 11, group_id: 1, month: 2, status: 'confirmed', dividend: 0 }
];
const result3 = getMemberFinancialStatus(mockMember as any, mockGroup as any, mockAuctions2 as any, mockPayments as any);
console.log('\n--- ACCUMULATION TEST (2 CONFIRMED AUCS + 1 PAYMENT) ---');
console.log('Balance:', result3.balance);
