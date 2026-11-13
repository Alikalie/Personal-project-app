import { formatSLE } from '@/lib/money';
import type { ReceiptData, ReceiptLayout } from '@/lib/receipt/types';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeSierraLeonePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('232')) return digits.length === 11 ? `+${digits}` : null;
  if (digits.startsWith('0')) return digits.length === 9 ? `+232${digits.slice(1)}` : null;
  if (digits.length === 8) return `+232${digits}`;
  return null;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-SL', {
    timeZone: 'Africa/Freetown',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function paymentLabel(method: string): string {
  if (method === 'orange_money') return 'Orange Money';
  if (method === 'afrimoney') return 'Afrimoney';
  if (method === 'cash') return 'Cash';
  if (method === 'other') return 'Other';
  return method.replace(/_/g, ' ');
}

function row(label: string, value: string, emphasis = false): string {
  return `<div class="row${emphasis ? ' emphasis' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function saleContent(data: Extract<ReceiptData, { kind: 'sale' }>): string {
  const items = data.items.map((item) => `
    <div class="item">
      <div class="item-name">${escapeHtml(item.name)} × ${item.quantity}</div>
      <div class="row"><span>${escapeHtml(formatSLE(item.unitPriceMinor))} each</span><strong>${escapeHtml(formatSLE(item.lineTotalMinor))}</strong></div>
    </div>`).join('');
  const payments = data.payments.map((payment) => row(paymentLabel(payment.method), formatSLE(payment.amountMinor))).join('');
  return `
    <h2>Sale receipt</h2>
    ${data.customerName ? row('Customer', data.customerName) : ''}
    ${row('Cashier', data.cashierName)}
    <section>${items}</section>
    <section class="totals">
      ${row('Subtotal', formatSLE(data.subtotalMinor))}
      ${data.discountMinor > 0 ? row('Discount', `-${formatSLE(data.discountMinor)}`) : ''}
      ${row('Total', formatSLE(data.totalMinor), true)}
    </section>
    <section class="payments"><h3>Payment summary</h3>${payments || row('Payment', 'Credit sale')}</section>
    ${data.balanceOwedMinor > 0 ? `<div class="balance">${row('Balance owed', formatSLE(data.balanceOwedMinor), true)}</div>` : ''}
    ${data.changeMinor > 0 ? row('Change given', formatSLE(data.changeMinor)) : ''}`;
}

function repaymentContent(data: Extract<ReceiptData, { kind: 'repayment' }>): string {
  return `
    <h2>Payment receipt</h2>
    ${row('Customer', data.customerName)}
    ${row('Cashier', data.cashierName)}
    ${row('Method', paymentLabel(data.method))}
    ${row('Amount paid', formatSLE(data.paymentMinor), true)}
    ${row('Previous balance', formatSLE(data.previousBalanceMinor))}
    ${row('New balance', formatSLE(data.newBalanceMinor), true)}
    ${data.note ? row('Note', data.note) : ''}`;
}

export function receiptHtml(data: ReceiptData, layout: ReceiptLayout = 'compact'): string {
  const logo = data.business.logoDataUri
    && /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(data.business.logoDataUri)
    ? `<img class="logo" src="${escapeHtml(data.business.logoDataUri)}" alt="${escapeHtml(data.business.name)} logo">`
    : '';
  const content = data.kind === 'sale' ? saleContent(data) : repaymentContent(data);
  const compact = layout === 'compact';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { size: ${compact ? '80mm auto' : 'A4'}; margin: ${compact ? '4mm' : '18mm'}; }
* { box-sizing: border-box; }
body { margin: 0; color: #17211b; font-family: Arial, sans-serif; font-size: ${compact ? '12px' : '14px'}; line-height: 1.45; }
.receipt { width: 100%; ${compact ? '' : 'max-width: 720px; margin: 0 auto;'} }
.brand { text-align: center; padding-bottom: 12px; border-bottom: 1px dashed #9ba69f; }
.logo { display: block; max-width: 60mm; max-height: 24mm; object-fit: contain; margin: 0 auto 8px; }
h1 { margin: 0; font-size: ${compact ? '18px' : '24px'}; }
h2 { margin: 14px 0 8px; font-size: ${compact ? '15px' : '18px'}; }
h3 { margin: 0 0 6px; font-size: inherit; }
p { margin: 4px 0; color: #59645d; }
.meta { margin-top: 8px; color: #59645d; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; }
.row span { color: #59645d; }
.row strong { text-align: right; }
.item { padding: 7px 0; border-bottom: 1px dashed #d1d8d3; }
.item-name { font-weight: 700; overflow-wrap: anywhere; }
section { margin-top: 10px; }
.totals, .payments { padding-top: 7px; border-top: 1px dashed #9ba69f; }
.emphasis { font-size: ${compact ? '14px' : '17px'}; font-weight: 700; }
.balance { margin-top: 10px; padding: 8px; background: #e7f2eb; border-radius: 6px; }
.footer { margin-top: 18px; padding-top: 10px; border-top: 1px dashed #9ba69f; text-align: center; color: #59645d; }
</style>
</head>
<body>
<main class="receipt">
  <header class="brand">
    ${logo}
    <h1>${escapeHtml(data.business.name)}</h1>
    ${data.business.address ? `<p>${escapeHtml(data.business.address)}</p>` : ''}
    ${data.business.phone ? `<p>${escapeHtml(data.business.phone)}</p>` : ''}
    ${data.business.header ? `<p>${escapeHtml(data.business.header)}</p>` : ''}
  </header>
  <div class="meta">${row('Receipt', data.receiptNo)}${row('Date', dateLabel(data.issuedAt))}</div>
  ${content}
  <footer class="footer">${escapeHtml(data.business.footer || 'Thank you for your business.')}<br>${escapeHtml('Generated by MiShop')}</footer>
</main>
</body>
</html>`;
}

// Examples: escapeHtml('<b>') returns '&lt;b&gt;'; normalizeSierraLeonePhone('076123456') returns '+23276123456'.
