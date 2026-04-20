import { fmt, fmtMonth, fmtDate, amtToWords, APP_NAME } from './index'
import type { Group, Auction, Member } from '@/types'

export function printPayoutVoucher(group: Group, auc: Auction, winner: Member, settleDate: string, firmName: string) {
  const printWin = window.open('', '_blank')
  if (!printWin) return

  const html = `
    <html>
      <head>
        <title>Payout Voucher - ${group.name}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #000; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: 900; text-transform: uppercase; }
          .firm-name { font-size: 18px; font-weight: bold; margin-top: 5px; }
          .voucher-info { margin-bottom: 40px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
          .label { font-weight: bold; color: #555; }
          .value { font-weight: 900; font-size: 16px; }
          .payout-box { background: #f8fafc; border: 2px solid #000; padding: 20px; text-align: center; margin: 40px 0; border-radius: 8px; }
          .amount { font-size: 32px; font-weight: 900; }
          .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
          .sig-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Payout Confirmation Voucher</div>
          <div class="firm-name">${firmName}</div>
        </div>
        
        <div class="voucher-info">
          <div class="row"><span class="label">Group Name:</span><span class="value">${group.name}</span></div>
          <div class="row"><span class="label">Auction Month:</span><span class="value">M${auc.month} (${fmtMonth(auc.month, group.start_date)})</span></div>
          <div class="row"><span class="label">Member Name:</span><span class="value">${winner.persons?.name}</span></div>
          <div class="row"><span class="label">Ticket # :</span><span class="value">${winner.ticket_no}</span></div>
          <div class="row"><span class="label">Settlement Date:</span><span class="value">${settleDate}</span></div>
        </div>

        <div class="payout-box">
          <div class="label">NET PAYOUT AMOUNT</div>
          <div class="amount" style="font-weight: 900; font-size: 32px; font-family: 'Courier New', Courier, monospace;">${fmt(auc.net_payout || auc.auction_discount)}</div>
          <div style="font-weight: bold; font-size: 14px; margin-top: 5px; text-transform: uppercase;">${amtToWords(auc.net_payout || auc.auction_discount)}</div>
          <div style="font-size: 12px; margin-top: 10px; opacity: 0.6;">(Rupees equivalent calculated as per group rules)</div>
        </div>

        <div class="signatures">
          <div class="sig-box">Member's Signature</div>
          <div class="sig-box">Authorized Signature<br/>(${firmName})</div>
        </div>

        <div style="margin-top: 50px; font-size: 10px; text-align: center; color: #777;">
          This is a computer generated voucher and remains valid only with official signature/stamp.
        </div>

        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
    </html>
  `
  printWin.document.write(html)
  printWin.document.close()
}

export function printMemberList(group: Group, members: Member[], firmName: string) {
  const printWin = window.open('', '_blank')
  if (!printWin) return

  const now = new Date().toLocaleDateString()
  const html = `
    <html>
      <head>
        <title>Member Directory - ${group.name}</title>
        <style>
          body { font-family: sans-serif; padding: 30px; line-height: 1.4; color: #000; }
          .header { border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
          .title { font-size: 20px; font-weight: bold; }
          .group-info { font-size: 13px; color: #333; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #eee; font-weight: bold; text-transform: uppercase; }
          .mono { font-family: monospace; }
          .sig-col { width: 120px; }
          .footer { margin-top: 30px; font-size: 10px; text-align: right; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${firmName} - Member Directory</div>
          <div class="group-info">Group: <b>${group.name}</b> | Value: <b>${fmt(group.chit_value || 0)}</b> | First Auction: ${group.start_date}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px">Ticket</th>
              <th>Member Name</th>
              <th>Phone Number</th>
              <th>Address</th>
              <th>Won Amount</th>
              <th class="sig-col">Signature</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(m => `
              <tr>
                <td class="mono">#${m.ticket_no}</td>
                <td><b>${m.persons?.name}</b></td>
                <td class="mono">${m.persons?.phone || '-'}</td>
                <td class="mono">${m.persons?.address || '-'}</td>
                <td style="width: 100px"></td>
                <td></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">Printed from ${APP_NAME} on ${now}</div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
    </html>
  `
  printWin.document.write(html)
  printWin.document.close()
}
