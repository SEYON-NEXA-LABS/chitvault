export type Lang = 'en' | 'ta';

export const dictionary: Record<Lang, Record<string, string>> = {
  en: {
    // Sidebar
    nav_dashboard: 'Dashboard',
    nav_groups: 'Chit Groups',
    nav_members: 'Members',
    nav_transactions: 'Transactions',
    nav_auctions: 'Auctions',
    nav_schemes: 'Auction Schemes',
    nav_payments: 'Payments',
    nav_cashbook: 'Daily Cash',
    nav_reports: 'Reports',
    nav_collection: 'Collection Report',
    nav_manage: 'Manage',
    nav_team: 'Team',
    nav_settings: 'Settings',
    
    // Header
    signed_in_as: 'Signed in as',
    sign_out: 'Sign Out',
    
    // General
    total_outstanding: 'Total Outstanding',
    due_date: 'Due Date',
    payout: 'Payout',
    commission: 'Commission',
    surplus: 'Surplus',
    dividend: 'Dividend',
    search: 'Search...',
    print: 'Print',
    new_group: 'New Group',
    add_member: 'Add Member',
    record_payment: 'Record Payment'
  },
  ta: {
    // Sidebar
    nav_dashboard: 'முகப்பு',
    nav_groups: 'குழுக்கள்',
    nav_members: 'உறுப்பினர்கள்',
    nav_transactions: 'பரிவர்த்தனை',
    nav_auctions: 'ஏலம்',
    nav_schemes: 'ஏல முறைகள்',
    nav_payments: 'பணம் செலுத்துதல்',
    nav_cashbook: 'தினசரி ரொக்கம்',
    nav_reports: 'அறிக்கைகள்',
    nav_collection: 'வசூல் அறிக்கை',
    nav_manage: 'நிர்வாகம்',
    nav_team: 'குழு',
    nav_settings: 'அமைப்புகள்',
    
    // Header
    signed_in_as: 'உள்நுழைந்துள்ள மின்னஞ்சல்',
    sign_out: 'வெளியேறு',

    // General
    total_outstanding: 'மொத்த நிலுவை',
    due_date: 'தவணை தேதி',
    payout: 'கொடுப்பனவு',
    commission: 'கமிஷன்',
    surplus: 'உபரி',
    dividend: 'தள்ளுபடி',
    search: 'தேடுக...',
    print: 'அச்சிடுக',
    new_group: 'புதிய குழு',
    add_member: 'உறுப்பினர் சேர்க்க',
    record_payment: 'பணம் செலுத்த'
  }
};
