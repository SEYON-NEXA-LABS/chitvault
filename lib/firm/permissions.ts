import type { UserRole } from '@/types'

// ── What each role can do ─────────────────────────────────────
export const PERMISSIONS = {
  // Groups
  createGroup:  ['owner'] as UserRole[],
  editGroup:    ['owner'] as UserRole[],
  deleteGroup:  ['owner'] as UserRole[],
  archiveGroup: ['owner'] as UserRole[],
  viewGroups:   ['owner', 'staff'] as UserRole[],

  // Members
  addMember:    ['owner'] as UserRole[],
  editMember:   ['owner'] as UserRole[],
  deleteMember: ['owner'] as UserRole[],
  viewMembers:  ['owner', 'staff'] as UserRole[],
  memberActions:['owner'] as UserRole[], // transfer, defaulter, foreman

  // Auctions
  recordAuction: ['owner'] as UserRole[],
  deleteAuction: ['owner'] as UserRole[],
  viewAuctions:  ['owner', 'staff'] as UserRole[],

  // Payments
  recordPayment: ['owner', 'staff'] as UserRole[],
  viewPayments:  ['owner', 'staff'] as UserRole[],
  deletePayment: ['owner'] as UserRole[],

  // Cashbook & Denominations
  viewCashbook:     ['owner', 'staff'] as UserRole[],
  recordCashEntry:  ['owner', 'staff'] as UserRole[],
  deleteCashEntry:  ['owner'] as UserRole[],

  // Settlement
  viewSettlement:   ['owner', 'staff'] as UserRole[],
  recordSettlement: ['owner', 'staff'] as UserRole[],
  deleteSettlement: ['owner'] as UserRole[],

  // Reports
  viewReports:     ['owner', 'staff'] as UserRole[],
  viewCollection:  ['owner', 'staff'] as UserRole[],

  // Team & Settings
  viewTeam:      ['owner'] as UserRole[],
  inviteStaff:   ['owner'] as UserRole[],
  removeStaff:   ['owner'] as UserRole[],
  viewSettings:  ['owner'] as UserRole[],
}

export type Permission = keyof typeof PERMISSIONS

export function can(role: UserRole | null | undefined, action: Permission): boolean {
  if (!role) return false
  if (role === 'superadmin') return true
  return PERMISSIONS[action].includes(role)
}

// React hook-friendly version
export function usePermission(role: UserRole | null | undefined) {
  return (action: Permission) => can(role, action)
}
