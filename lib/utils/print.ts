import { fmt, fmtDate, amtToWords, APP_DEVELOPER } from './index'
import { getMemberFinancialStatus } from './chitLogic'
import type { Firm, Group, Auction, Member, ForemanCommission, Payment } from '@/types'

/**
 * Standardizes the print window creation and injection process.
 */
function createPrintWindow(content: string, title: string = 'Print') {
  const printWindow = window.open('', '_blank', 'width=900,height=900')
  if (!printWindow) {
    alert('Please allow popups to print.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          :root {
            --print-padding: 20px;
            --print-gap: 15px;
            --print-gap-sm: 5px;
            --print-radius: 6px;
            --print-width-sm: 100px;
            --print-width-md: 150px;
            --print-font-xs: 8px;
            --print-font-label: 10px;
            --print-font-base: 12px;
            --print-font-md: 14px;
            --print-font-lg: 18px;
            --print-font-xl: 24px;
            --print-border: 1px solid #000;
            --print-border-light: 1px solid #ddd;
            --print-bg-light: #f5f5f5;
            --print-color-muted: #666;
          }
          body { font-family: 'Inter', sans-serif; margin: 0; padding: var(--print-padding); color: #000; background: #fff; line-height: 1.4; }
          .voucher { border: var(--print-border); padding: var(--print-padding); max-width: 800px; margin: 0 auto; position: relative; overflow: hidden; }
          .firm-name { font-size: var(--print-font-lg); font-weight: 900; text-transform: uppercase; margin: 0; }
          .firm-addr { font-size: var(--print-font-label); font-weight: 700; color: var(--print-color-muted); text-transform: uppercase; }
          .voucher-title { font-size: var(--print-font-title); font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: -1px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--print-padding); margin-bottom: var(--print-gap); }
          .label { font-size: var(--print-font-label); font-weight: 900; color: var(--print-color-muted); text-transform: uppercase; margin-bottom: 2px; display: block; }
          .val { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .payout-box { background: var(--print-bg-light); border: var(--print-border); padding: 15px; border-radius: 8px; margin-bottom: var(--print-gap); }
          .payout-amt { font-size: var(--print-font-amt); font-weight: 900; letter-spacing: -1px; }
          .words { font-size: 11px; font-weight: 700; font-style: italic; color: #444; margin-top: 5px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: var(--print-gap); }
          .table th { text-align: left; font-size: var(--print-font-label); font-weight: 900; text-transform: uppercase; padding: 8px; border-bottom: var(--print-border); }
          .table td { padding: 8px; border-bottom: var(--print-border-light); font-size: var(--print-font-base); font-weight: 700; }
          .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 30px; text-align: center; }
          .sign-box { border: 1px dashed #ccc; height: 50px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; font-size: var(--print-font-label); font-weight: 900; text-transform: uppercase; border-radius: 6px; }
          .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; font-weight: 900; color: rgba(0,0,0,0.03); pointer-events: none; white-space: nowrap; }
          .denom-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .denom-table th, .denom-table td { border: var(--print-border-light); padding: 4px 8px; font-size: var(--print-font-label); font-weight: 700; }
          .denom-table th { background: var(--print-bg-light); text-align: left; text-transform: uppercase; color: var(--print-color-muted); }
          @media print { body { padding: 0; } .voucher { border: none; } }
        </style>
      </head>
      <body>
        ${content}
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

/**
 * Prints a Payment Receipt (Individual Receipt).
 */
export function printPaymentReceipt(
  firm: Firm | null,
  personName: string,
  targetDues: any[],
  totalAmount: number,
  paymentDate: string,
  paymentMode: string,
  t: (k: string) => string
) {
  const content = `
    <div class="voucher">
      <div class="watermark">RECEIPT</div>
      <div class="header">
        <div>
          <h1 class="voucher-title">RECEIPT</h1>
          <div class="val" style="font-size: 9px; opacity: 0.5;">REF: CV-REC-${Date.now().toString().slice(-6)}</div>
        </div>
        <div style="text-align: right;">
          <h2 class="firm-name">${firm?.name || 'ChitVault Firm'}</h2>
          <div class="firm-addr">${firm?.address || 'Premium Ledger Management'}</div>
        </div>
      </div>

      <div class="grid">
        <div>
          <span class="label">${t('member_name')}</span>
          <div class="val">${personName}</div>
        </div>
        <div style="text-align: right;">
          <span class="label">${t('date')}</span>
          <div class="val">${fmtDate(paymentDate, '')}</div>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>${t('group')}</th>
            <th>${t('month')}</th>
            <th style="text-align: right;">${t('amount')}</th>
          </tr>
        </thead>
        <tbody>
          ${targetDues.map(d => `
            <tr>
              <td>${d.groups?.name || d.groupName || ''}</td>
              <td>Month ${d.month}</td>
              <td style="text-align: right;">${fmt(d.amount || (d.amount_due - d.amount_paid))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="payout-box">
        <span class="label">${t('total_received')} (${paymentMode})</span>
        <div class="payout-amt">${fmt(totalAmount)}</div>
        <div class="words">${amtToWords(totalAmount)}</div>
      </div>

      <div class="footer">
        <div class="sign-line">${t('member_sign') || 'Subscriber Signature'}</div>
        <div class="sign-line">${t('manager_sign') || 'Manager Signature'}</div>
      </div>
    </div>
  `
  createPrintWindow(content, `Receipt - ${personName}`)
}

/**
 * Prints a Payout Voucher (Auction Winner Payout).
 */
export function printPayoutVoucher(
  group: Group,
  auction: Auction,
  winner: Member,
  commission: ForemanCommission | undefined,
  firm: Firm | null,
  t: (k: string) => string
) {
  const content = `
    <div class="voucher">
      <div class="watermark">PAYOUT</div>
      <div class="header">
        <div>
          <h1 class="voucher-title">${t('voucher_payout') || 'PAYOUT VOUCHER'}</h1>
          <div class="val" style="font-size: 10px; opacity: 0.5;">REF: AUC-${group.name.slice(0,3)}-${auction.month}</div>
        </div>
        <div style="text-align: right;">
          <h2 class="firm-name">${firm?.name || 'ChitVault Firm'}</h2>
          <div class="firm-addr">${firm?.address || 'Premium Ledger Management'}</div>
        </div>
      </div>

      <div class="grid">
        <div>
          <span class="label">${t('winner')}</span>
          <div class="val">${winner.persons?.name || ''}</div>
          <div class="val" style="font-size: 11px; opacity: 0.6;">Ticket #${winner.ticket_no}</div>
        </div>
        <div style="text-align: right;">
          <span class="label">${t('group')}</span>
          <div class="val">${group.name}</div>
          <div class="val" style="font-size: 11px; opacity: 0.6;">${fmtDate(auction.auction_date, '')}</div>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gross Chit Value</td>
            <td style="text-align: right;">${fmt(group.chit_value)}</td>
          </tr>
          <tr>
            <td>Winning Bid (Sacrifice)</td>
            <td style="text-align: right;">- ${fmt(auction.auction_discount)}</td>
          </tr>
          ${commission ? `
            <tr>
              <td>Foreman Commission</td>
              <td style="text-align: right;">- ${fmt(commission.commission_amt)}</td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <div class="payout-box">
        <span class="label">${t('net_payout')}</span>
        <div class="payout-amt">${fmt(auction.net_payout || (auction.payout_amount))}</div>
        <div class="words">${amtToWords(auction.net_payout || auction.payout_amount)}</div>
      </div>

      <table class="denom-table">
        <thead>
          <tr>
            <th>Denomination</th>
            <th style="text-align: center; width: var(--print-width-sm);">Count (Notes)</th>
            <th style="text-align: right; width: var(--print-width-md);">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${[2000, 500, 200, 100, 50, 20, 10, 5, 2, 1].map(v => `
            <tr>
              <td>₹${v} x</td>
              <td></td>
              <td></td>
            </tr>
          `).join('')}
          <tr>
            <td style="background: var(--print-bg-light); font-weight: 900; text-align: right;">TOTAL</td>
            <td style="background: var(--print-bg-light); text-align: center;"></td>
            <td style="background: var(--print-bg-light); font-size: var(--print-font-md); font-weight: 900;"></td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div class="sign-box">${t('member_sign') || 'Receiver Signature'}</div>
        <div class="sign-box">${t('manager_sign') || 'Manager Signature'}</div>
      </div>
    </div>
  `
  createPrintWindow(content, `Payout - ${winner.persons?.name}`)
}

/**
 * Prints a Settlement Report (Final Group Settlement or Winner Payout).
 */
export function printSettlementReport(
  firm: Firm | null,
  member: any,
  group: any,
  isWinner: boolean,
  actualPrize: number | null,
  settlementTotal: number,
  entries: any[],
  balances: any[],
  t: (k: string) => string
) {
  const content = `
    <div class="voucher">
      <div class="watermark">SETTLEMENT</div>
      <div class="header">
        <div>
          <h1 class="voucher-title">${isWinner ? (t('voucher_payout') || 'PAYOUT VOUCHER') : (t('settlement_voucher') || 'SETTLEMENT')}</h1>
          <div class="val" style="font-size: var(--print-font-label); opacity: 0.5;">REF: SET-${Date.now().toString().slice(-6)}</div>
        </div>
        <div style="text-align: right;">
          <h2 class="firm-name">${firm?.name || 'ChitVault Firm'}</h2>
          <div class="firm-addr">${firm?.address || 'Premium Ledger Management'}</div>
        </div>
      </div>

      <div class="grid">
        <div>
          <span class="label">${t('member_name')}</span>
          <div class="val">${member?.persons?.name || ''}</div>
        </div>
        <div style="text-align: right;">
          <span class="label">${t('group_name_label')}</span>
          <div class="val">${group?.name || ''}</div>
        </div>
      </div>

      ${!isWinner ? `
        <table class="table">
          <thead>
            <tr>
              <th>${t('settle_month_tag') || 'Month'}</th>
              <th style="text-align: right;">${t('amount')}</th>
              <th style="text-align: right;">${t('balance')}</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map((e, i) => `
              <tr>
                <td>
                  ${e.label || `Month ${i+1}`}
                  <div style="font-size: var(--print-font-xs); opacity: 0.5; font-weight: normal;">${e.date ? fmtDate(e.date, '') : ''}</div>
                </td>
                <td style="text-align: right;">${fmt(e.amount)}</td>
                <td style="text-align: right;">${fmt(balances[i]?.running)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <div style="padding: var(--print-gap); border: 1px dashed var(--print-border-light); border-radius: var(--print-radius); margin-bottom: var(--print-padding); text-align: center;">
          <div class="label">${t('settle_winner_month')}</div>
          <div class="val" style="font-size: var(--print-font-lg);">${member?.auctionMonth ? `Month ${member.auctionMonth}` : ''}</div>
          <div style="font-size: var(--print-font-label); opacity: 0.5; margin-top: var(--print-gap-sm);">${member?.auctionDate ? fmtDate(member.auctionDate, '') : ''}</div>
        </div>
      `}

      <div class="payout-box">
        <span class="label">${t('settle_final_payout') || 'Final Payout'}</span>
        <div class="payout-amt">${fmt(isWinner ? actualPrize : settlementTotal)}</div>
        <div class="words">${amtToWords(isWinner ? actualPrize : settlementTotal)}</div>
      </div>

      <table class="denom-table">
        <thead>
          <tr>
            <th>Denomination</th>
            <th style="text-align: center; width: var(--print-width-sm);">Count (Notes)</th>
            <th style="text-align: right; width: var(--print-width-md);">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${[2000, 500, 200, 100, 50, 20, 10, 5, 2, 1].map(v => `
            <tr>
              <td>₹${v} x</td>
              <td></td>
              <td></td>
            </tr>
          `).join('')}
          <tr>
            <td style="background: var(--print-bg-light); font-weight: 900; text-align: right;">TOTAL</td>
            <td style="background: var(--print-bg-light); text-align: center;"></td>
            <td style="background: var(--print-bg-light); font-size: var(--print-font-md); font-weight: 900;"></td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div class="sign-box">${t('settle_member_sign') || 'Member Signature'}</div>
        <div class="sign-box">${t('settle_manager_sign') || 'Manager Signature'}</div>
      </div>
    </div>
  `
  createPrintWindow(content, `Settlement - ${member?.persons?.name}`)
}

/**
 * Prints a Member List for a group.
 */
export function printMemberList(
  group: Group, 
  members: Member[], 
  auctions: Auction[], 
  payments: Payment[], 
  firm: Firm | null, 
  t: (k: string) => string,
  options: { populateCols?: string[] } = {}
) {

  // All possible columns definitions
  const COL_DEFS: Record<string, { label: string, align?: string, width?: string }> = {
    'ticket_no': { label: 'Ticket', align: 'left', width: '60px' },
    'name': { label: 'Member Name', align: 'left' },
    'status': { label: 'Status', align: 'left', width: '80px' },
    'won_month': { label: 'Won Month', align: 'left', width: '90px' },
    'won_amount': { label: 'Won Amount', align: 'right', width: '100px' },
    'signature': { label: 'Signature', align: 'left', width: '120px' },
    'remarks': { label: 'Remarks', align: 'left', width: '150px' }
  }

  // Summary fields (not in table)
  const summaryIds = ['chit_value', 'duration', 'monthly_contribution', 'start_date', 'dividend']
  
  // FIXED Table Layout for consistent reporting
  const tableIds = ['ticket_no', 'name', 'status', 'won_month', 'won_amount', 'signature', 'remarks']
  
  // Columns selected for population
  const populateIds = options.populateCols || tableIds
  
  const content = `
    <div style="max-width: 900px; margin: 0 auto; font-family: 'Inter', sans-serif; padding: var(--print-padding);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--print-padding);">
        <h1 style="text-transform: uppercase; font-weight: 900; margin: 0; font-size: var(--print-font-xl);">${group.name}</h1>
        <div style="text-align: right;">
          <div style="font-size: var(--print-font-lg); font-weight: 900; text-transform: uppercase;">${firm?.name || 'CHITVAULT FIRM'}</div>
          <div style="font-size: var(--print-font-label); font-weight: 700; color: #666;">${firm?.address || 'Premium Ledger Management'}</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--print-gap); background: var(--print-bg-light); padding: var(--print-gap); border-radius: var(--print-radius); margin-bottom: var(--print-padding); border: var(--print-border-light);">
        <div>
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: #666; text-transform: uppercase;">Chit Value</div>
          <div style="font-size: var(--print-font-md); font-weight: 900;">${populateIds.includes('chit_value') ? fmt(group.chit_value) : ''}</div>
        </div>
        <div>
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: #666; text-transform: uppercase;">Duration</div>
          <div style="font-size: var(--print-font-md); font-weight: 900;">${populateIds.includes('duration') ? `${group.duration} Months` : ''}</div>
        </div>
        <div>
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: #666; text-transform: uppercase;">Monthly Pay</div>
          <div style="font-size: var(--print-font-md); font-weight: 900;">${populateIds.includes('monthly_contribution') ? fmt(group.monthly_contribution) : ''}</div>
        </div>
        <div>
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: #666; text-transform: uppercase;">Start Date</div>
          <div style="font-size: var(--print-font-md); font-weight: 900;">${populateIds.includes('start_date') ? fmtDate(group.start_date, '') : ''}</div>
        </div>
        <div>
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: var(--print-color-muted); text-transform: uppercase;">
            ${group.auction_scheme === 'ACCUMULATION' ? 'Acc. Surplus Share' : 'Total Dividend'}
          </div>
          <div style="font-size: var(--print-font-md); font-weight: 900;">
            ${populateIds.includes('dividend') ? (
                group.auction_scheme === 'ACCUMULATION' 
                ? fmt((group.accumulated_surplus || 0) / (group.num_members || 1))
                : fmt(auctions.reduce((s, a) => s + (a.dividend || 0), 0))
            ) : ''}
          </div>
        </div>
      </div>

      <table class="table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            ${tableIds.map(id => `<th style="text-align: ${COL_DEFS[id]?.align || 'left'}; width: ${COL_DEFS[id]?.width || 'auto'};">${COL_DEFS[id]?.label || id}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            const wonAuc = auctions.find(a => a.winner_id === m.id && a.status === 'confirmed')

            return `
              <tr>
                ${tableIds.map(id => {
                  let val = ''
                  // Mandatory columns (ticket_no, name) are ALWAYS populated to identify rows
                  if (populateIds.includes(id) || id === 'ticket_no' || id === 'name') {
                    if (id === 'ticket_no') val = `#${m.ticket_no}`
                    if (id === 'name') val = `<span style="text-transform: uppercase;">${m.persons?.name}</span><div style="font-size: var(--print-font-xs); opacity: 0.5;">${m.persons?.phone || ''}</div>`
                    if (id === 'status') val = m.status === 'foreman' ? 'FOREMAN' : 'ACTIVE'
                    if (id === 'won_month' && wonAuc) val = `Month ${wonAuc.month}`
                    if (id === 'won_amount' && wonAuc) val = fmt(wonAuc.net_payout || wonAuc.payout_amount)
                  }
                  
                  const align = COL_DEFS[id]?.align || 'left'
                  const border = id === 'signature' ? 'border-bottom: var(--print-border);' : ''
                  
                  return `<td style="text-align: ${align}; ${border}">${val}</td>`
                }).join('')}
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
  `
  createPrintWindow(content, `Members - ${group.name}`)
}

/**
 * Prints a Collection Report (Outstanding Dues).
 */
export function printCollectionsReport(
  firm: Firm | null,
  data: any[],
  t: (k: string) => string
) {
  const content = `
    <div style="max-width: 900px; margin: 0 auto; font-family: 'Inter', sans-serif; padding: var(--print-padding);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--print-padding);">
        <h1 style="text-transform: uppercase; font-weight: 900; margin: 0; font-size: var(--print-font-xl);">Collection Report</h1>
        <div style="text-align: right;">
          <div style="font-size: var(--print-font-lg); font-weight: 900; text-transform: uppercase;">${firm?.name || 'CHITVAULT FIRM'}</div>
          <div style="font-size: var(--print-font-label); font-weight: 700; color: #666;">${firm?.address || 'Premium Ledger Management'}</div>
        </div>
      </div>

      <div style="background: var(--print-bg-light); padding: var(--print-gap); border-radius: var(--print-radius); margin-bottom: var(--print-padding); border: var(--print-border-light); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: #666; text-transform: uppercase;">Total Outstanding</div>
          <div style="font-size: var(--print-font-lg); font-weight: 900;">${fmt(data.reduce((s, x) => s + Number(x.total_balance), 0))}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: var(--print-font-xs); font-weight: 900; color: #666; text-transform: uppercase;">Report Date</div>
          <div style="font-size: var(--print-font-md); font-weight: 900;">${fmtDate(new Date().toISOString(), '')}</div>
        </div>
      </div>

      <table class="table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left;">Subscriber</th>
            <th style="text-align: left;">Groups / Pending Months</th>
            <th style="text-align: right;">Balance (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(person => {
            const memberships = (person.memberships || []).map((m: any) => {
              const pendingDues = (m.dues || []).filter((d: any) => (d.amount_due - d.amount_paid) > 0.1)
              const groupBal = pendingDues.reduce((s: number, d: any) => s + (d.amount_due - d.amount_paid), 0)
              const months = pendingDues.map((d: any) => `M${d.month}`).join(', ')
              
              return `<div style="margin-bottom: var(--print-gap-sm); display: flex; justify-content: space-between;">
                <div>
                  <span style="font-weight: 900; font-size: var(--print-font-label);">${m.group?.name}</span>
                  <span style="font-size: var(--print-font-label); color: var(--print-color-muted); margin-left: var(--print-gap-sm);">[${months}]</span>
                </div>
                <span style="font-size: var(--print-font-label); font-weight: 700;">${fmt(groupBal)}</span>
              </div>`
            }).join('')

            return `
              <tr style="border-bottom: var(--print-border-light);">
                <td style="padding: var(--print-gap) 0;">
                  <div style="font-weight: 900; font-size: var(--print-font-md); text-transform: uppercase;">${person.person_name}</div>
                  <div style="font-size: var(--print-font-label); color: var(--print-color-muted);">${person.person_phone}</div>
                </td>
                <td style="padding: var(--print-gap) 0;">${memberships}</td>
                <td style="padding: var(--print-gap) 0; text-align: right; font-weight: 900; font-size: var(--print-font-md);">${fmt(person.total_balance)}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
  `
  createPrintWindow(content, `Collection Report - ${fmtDate(new Date().toISOString(), '')}`)
}
