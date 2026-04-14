'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmtDate } from '@/lib/utils'
import { Btn, Card, Badge, Loading, Toast, Modal, Field } from '@/components/ui'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import { UserPlus, Trash2, Shield, User, Crown, Mail, UserX, CheckCircle } from 'lucide-react'
import type { Firm } from '@/types'

interface TeamMember {
  id:        string
  full_name: string | null
  role:      string
  status:    string
  created_at: string
  email?:    string
}

interface Invite {
  id:         string
  email:      string
  role:       string
  status:     string
  created_at: string
  expires_at: string
}

const roleIcon = (role: string) => ({
  owner: <Crown size={13} style={{ color: '#2563eb' }} />,
  staff: <User size={13} style={{ color: '#5b8af5' }} />,
}[role] || <User size={13} />)

const roleBadge = (role: string) => {
  if (role === 'owner') return <Badge variant="accent">👑 Owner</Badge>
  if (role === 'staff') return <Badge variant="info">Staff</Badge>
  return <Badge variant="gray">{role}</Badge>
}

export default function TeamPage() {
  const supabase = createClient()
  const { firm, role, can, switchedFirmId } = useFirm()
  const { toast, show, hide } = useToast()

  const [members,  setMembers]  = useState<TeamMember[]>([])
  const [invites,  setInvites]  = useState<Invite[]>([])
  const [loading,  setLoading]  = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState<'staff'|'owner'>('staff')
  const [saving,   setSaving]   = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [firms,    setFirms]    = useState<Firm[]>([])

  const isSuper = role === 'superadmin'
  const targetId = isSuper ? switchedFirmId : firm?.id

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || '')

    // Load all profiles for this firm (Scoped)
    const { data: profiles } = await withFirmScope(
      supabase.from('profiles').select('id, full_name, role, status, created_at'),
      targetId
    ).is('deleted_at', null).order('created_at')

    setMembers(profiles || [])

    // Load pending invites (Scoped)
    const { data: inv } = await withFirmScope(
      supabase.from('invites').select('id, email, role, status, created_at, expires_at'),
      targetId
    ).order('created_at', { ascending: false })

    setInvites(inv || [])

    if (isSuper && firms.length === 0) {
      const { data: f } = await supabase.from('firms').select('id, name').order('name')
      setFirms(f || [])
    }
    setLoading(false)
  }, [supabase, isSuper, switchedFirmId, firm, firms.length])

  useEffect(() => { load(true) }, [load])

  async function sendInvite() {
    if (!firm || !inviteEmail.trim()) return
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(inviteEmail.trim())) {
      show('Please enter a valid email address.', 'error')
      return
    }
    setSaving(true)

    // Check if already a member
    const { data: existing } = await supabase
      .from('invites')
      .select('id')
      .eq('firm_id', firm.id)
      .eq('email', inviteEmail.toLowerCase().trim())
      .maybeSingle()

    if (existing) {
      show('An invite already exists for this email.', 'error')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('invites').insert({
      firm_id: firm.id,
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole,
      invited_by: user?.id,
      status: 'pending'
    })

    setSaving(false)
    if (error) { show(error.message, 'error'); return }

    show(`Invite sent to ${inviteEmail}`)
    
    // Log Activity
    await logActivity(firm.id, 'STAFF_ADDED', 'invite', inviteEmail, { role: inviteRole })
    setInviteOpen(false)
    setInviteEmail('')
    load()
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revoke this invite?')) return
    await supabase.from('invites').delete().eq('id', id)
    show('Invite revoked.')
    if (firm) await logActivity(firm.id, 'SETTING_UPDATED', 'invite', id, { action: 'revoke' })
    load()
  }

  async function changeRole(memberId: string, newRole: string) {
    if (memberId === currentUserId) { show("You can't change your own role.", 'error'); return }
    await supabase.from('profiles').update({ role: newRole }).eq('id', memberId)
    show('Role updated.')
    if (firm) await logActivity(firm.id, 'STAFF_ADDED', 'profile', memberId, { new_role: newRole })
    load()
  }

  async function removeMember(memberId: string) {
    if (memberId === currentUserId) { show("You can't remove yourself.", 'error'); return }
    if (!confirm('Are you sure you want to move this staff member to trash? Access will be revoked for 90 days.')) return
    const { error } = await supabase.from('profiles').update({ deleted_at: new Date() }).eq('id', memberId)
    if (error) { show(error.message, 'error'); return }
    show('Member moved to trash.')
    if (firm) await logActivity(firm.id, 'STAFF_ARCHIVED', 'profile', memberId)
    load()
  }

  async function toggleStatus(memberId: string, currentStatus: string) {
    if (memberId === currentUserId) { show("You can't deactivate yourself.", 'error'); return }
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
    if (nextStatus === 'inactive' && !confirm('Are you sure you want to disable access for this user? They will be logged out immediately.')) return
    
    await supabase.from('profiles').update({ status: nextStatus }).eq('id', memberId)
    show(`User ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`)
    if (firm) await logActivity(firm.id, 'SETTING_UPDATED', 'profile_status', memberId, { status: nextStatus })
    load()
  }

  // Copy invite link
  function copyInviteLink(inviteId: string) {
    const url = `${window.location.origin}/invite/${inviteId}`
    navigator.clipboard.writeText(url)
    show('Invite link copied!')
  }

  if (!can('viewTeam') && !isSuper) return (
    <div className="flex items-center justify-center py-20 text-center">
      <div>
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-sm" style={{ color: 'var(--text2)' }}>Only the firm owner can manage team members.</div>
      </div>
    </div>
  )

  if (loading) return <Loading />

  const pendingInvites = invites.filter(i => i.status === 'pending')

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header card with Firm Filter */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-[var(--text)]">Team Management</h1>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-base mb-1" style={{ color: 'var(--text)' }}>
              Team Members {targetId !== 'all' ? `— ${firms.find(f=>f.id===targetId)?.name || firm?.name || ''}` : '(Platform Wide)'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              {members.length} member{members.length !== 1 ? 's' : ''} · {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
            </p>
          </div>
          {can('inviteStaff') && (
            <Btn variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus size={14} /> Invite Staff
            </Btn>
          )}
        </div>
      </Card>

      {/* Role explanation */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Role Permissions
        </div>
        <div className="grid grid-cols-2 gap-0">
          {[
            { role: 'Owner', icon: '👑', color: 'var(--accent)', perms: ['Create & delete groups', 'Add & remove members', 'Record auctions', 'Record payments', 'All reports', 'Manage team & settings'] },
            { role: 'Staff', icon: '👤', color: 'var(--info)', perms: ['View all groups', 'View all members', 'Record auctions', 'Record payments', 'Collection report', 'View reports', '— Cannot modify structure'] },
          ].map(r => (
            <div key={r.role} className="p-5 border-r last:border-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span>{r.icon}</span>
                <span className="font-semibold text-sm" style={{ color: r.color }}>{r.role}</span>
              </div>
              <ul className="space-y-1.5">
                {r.perms.map(p => (
                  <li key={p} className="text-xs flex items-start gap-1.5" style={{ color: p.startsWith('—') ? 'var(--text3)' : 'var(--text2)' }}>
                    <span className="mt-0.5">{p.startsWith('—') ? '✗' : '✓'}</span> {p.replace('— ', '')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Active members */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          Active Members ({members.length})
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: m.role === 'owner' ? 'rgba(201,168,76,0.15)' : 'var(--info-dim)', color: m.role === 'owner' ? 'var(--accent)' : 'var(--info)' }}>
                  {(m.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    {m.full_name || 'Unnamed'}
                    {m.id === currentUserId && <span className="text-xs" style={{ color: 'var(--text3)' }}>(you)</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                    Joined {fmtDate(m.created_at)} {m.status === 'inactive' && <span className="text-[var(--danger)] font-bold ml-1.5">• ACCESS DISABLED</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {roleBadge(m.role)}
                {can('removeStaff') && m.id !== currentUserId && (
                  <div className="flex items-center gap-1.5">
                    {/* Change role */}
                    {m.role !== 'owner' && (
                      <Btn size="sm" variant="secondary" onClick={() => changeRole(m.id, 'owner')}
                        title="Promote to Owner">
                        <Shield size={12} /> Make Owner
                      </Btn>
                    )}
                    {m.role === 'owner' && (
                      <Btn size="sm" variant="secondary" onClick={() => changeRole(m.id, 'staff')}
                        title="Demote to Staff">
                        <User size={12} /> Make Staff
                      </Btn>
                    )}
                    <Btn size="sm" variant="secondary" onClick={() => toggleStatus(m.id, m.status)}
                      title={m.status === 'active' ? 'Deactivate User' : 'Activate User'}
                      style={{ color: m.status === 'active' ? 'var(--danger)' : 'var(--success)' }}>
                      {m.status === 'active' ? <UserX size={12} /> : <CheckCircle size={12} />}
                      {m.status === 'active' ? 'Disable' : 'Enable'}
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => removeMember(m.id)} title="Remove from Firm">
                      <Trash2 size={12} />
                    </Btn>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Pending Invites ({pendingInvites.length})
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--surface3)' }}>
                    <Mail size={14} style={{ color: 'var(--text3)' }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{inv.email}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      Invited {fmtDate(inv.created_at)} · Expires {fmtDate(inv.expires_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {roleBadge(inv.role)}
                  <Badge variant="gray">Pending</Badge>
                  <Btn size="sm" variant="secondary" onClick={() => copyInviteLink(inv.id)}>
                    Copy Link
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => revokeInvite(inv.id)}>
                    <Trash2 size={12} />
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* How to invite info */}
      <div className="p-4 rounded-xl border text-sm" style={{ background: 'rgba(91,138,245,0.06)', borderColor: 'rgba(91,138,245,0.2)', color: 'var(--info)' }}>
        <strong>How invites work:</strong> Click &quot;Invite Staff&quot; → enter their email → copy the invite link → send via WhatsApp or email. When they click the link, they create an account and automatically join your firm as Staff.
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Staff Member">
        <div className="space-y-4">
          <Field label="Email Address">
            <input className={inputClass} style={inputStyle} type="email" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)} placeholder="staff@example.com"
              onKeyDown={e => e.key === 'Enter' && sendInvite()} />
          </Field>
          <Field label="Role">
            <div className="grid grid-cols-2 gap-3">
              {(['staff','owner'] as const).map(r => (
                <button key={r} onClick={() => setInviteRole(r)}
                  className="p-4 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: inviteRole === r ? (r === 'owner' ? 'var(--accent)' : 'var(--info)') : 'var(--border)',
                    background: inviteRole === r ? (r === 'owner' ? 'rgba(201,168,76,0.08)' : 'var(--info-dim)') : 'var(--surface2)',
                  }}>
                  <div className="text-base mb-1">{r === 'owner' ? '👑' : '👤'}</div>
                  <div className="font-semibold text-sm capitalize" style={{ color: r === 'owner' ? 'var(--accent)' : 'var(--info)' }}>{r}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                    {r === 'owner' ? 'Full access including settings' : 'View & record payments only'}
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            💡 An invite link will be generated. Share it with your staff via WhatsApp or email. The link expires in 7 days.
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={sendInvite}>
            <UserPlus size={14} /> Send Invite
          </Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
