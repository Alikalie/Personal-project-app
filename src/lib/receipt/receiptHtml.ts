import { MISHOP_ICON_DATA_URI, MISHOP_WORDMARK_DATA_URI } from './brandAssets';

export const BRAND = {
  navy: '#0B2545',
  green: '#16A34A',
  greenDark: '#0B7D35',
  blue: '#0072C6',
  tint: '#EAF7EE',
  text: '#1F2A37',
  gray: '#5B6770',
  line: '#D9E2DC',
  amberBg: '#FFF4DC',
  amberText: '#7A4E0B',
} as const;

export type ReceiptLine = { name: string; qty: number; unitMinor: number; totalMinor: number };
export type ReceiptPayment = { method: string; amountMinor: number; reference?: string | null };
export type ReceiptLayout = 'compact' | 'a4';

export type ReceiptData = {
  type: 'sale' | 'payment';
  receiptNo: string;
  dateText: string;
  business: {
    name: string;
    address?: string | null;
    phone?: string | null;
    header?: string | null;
    footer?: string | null;
    logoDataUri?: string | null;
    currencyCode?: string | null;
  };
  cashierName?: string | null;
  customer?: { name: string; phone?: string | null } | null;
  items: ReceiptLine[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  payments: ReceiptPayment[];
  changeGivenMinor: number;
  creditMinor: number;
  customerBalanceAfterMinor?: number | null;
};

export type ReceiptOptions = { size: ReceiptLayout; fmt: (minor: number) => string };

const METHODS: Record<string, string> = {
  cash: 'Cash',
  orange_money: 'Orange Money',
  afrimoney: 'Afrimoney',
  other: 'Other',
};

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function receiptPageSize(data: ReceiptData, size: ReceiptLayout): { width: number; height: number } {
  if (size === 'a4') return { width: 595, height: 842 };
  const height = 560 + data.items.length * 34 + data.payments.length * 20
    + (data.creditMinor > 0 ? 70 : 0) + (data.business.logoDataUri ? 40 : 0);
  return { width: 227, height: Math.min(Math.max(height, 520), 6000) };
}

export function receiptHtml(data: ReceiptData, options: ReceiptOptions): string {
  const format = options.fmt;
  const compact = options.size === 'compact';
  const isPayment = data.type === 'payment';
  const business = data.business;
  const initial = esc((business.name || 'M').trim().charAt(0).toUpperCase());
  const validLogo = typeof business.logoDataUri === 'string'
    && /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(business.logoDataUri);

  const logo = validLogo
    ? `<img class="logo" src="${business.logoDataUri}" alt="">`
    : `<div class="logo initial">${initial}</div>`;
  const items = data.items
    .map((item) => `<tr><td class="nm">${esc(item.name)}<div class="sub">${item.qty} x ${format(item.unitMinor)}</div></td><td class="am">${format(item.totalMinor)}</td></tr>`)
    .join('');
  const payments = data.payments
    .map((payment) => `<tr><td>${esc(METHODS[payment.method] ?? payment.method)}${payment.reference ? `<div class="sub">Ref: ${esc(payment.reference)}</div>` : ''}</td><td class="am">${format(payment.amountMinor)}</td></tr>`)
    .join('');
  const paidTotal = data.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const meta = [
    ['Date', data.dateText],
    data.cashierName ? ['Served by', data.cashierName] : null,
    data.customer ? ['Customer', `${data.customer.name}${data.customer.phone ? ` (${data.customer.phone})` : ''}`] : null,
  ]
    .filter((row): row is [string, string] => row !== null)
    .map(([label, value]) => `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>`)
    .join('');
  const totals = isPayment
    ? ''
    : `<table class="t">
        <tr><td>Subtotal</td><td class="am">${format(data.subtotalMinor)}</td></tr>
        ${data.discountMinor > 0 ? `<tr class="disc"><td>Discount</td><td class="am">-${format(data.discountMinor)}</td></tr>` : ''}
      </table>
      <div class="total"><span>TOTAL</span><span>${format(data.totalMinor)}</span></div>`;
  const paidBlock = isPayment
    ? `<div class="total"><span>PAID</span><span>${format(paidTotal)}</span></div>`
    : '';
  const credit = !isPayment && data.creditMinor > 0
    ? `<div class="credit"><b>Balance owed: ${format(data.creditMinor)}</b>${
        data.customerBalanceAfterMinor != null ? `<div>Total owed by ${esc(data.customer?.name ?? 'customer')}: ${format(data.customerBalanceAfterMinor)}</div>` : ''
      }</div>`
    : '';
  const balanceAfter = isPayment && data.customerBalanceAfterMinor != null
    ? `<div class="${data.customerBalanceAfterMinor > 0 ? 'credit' : 'okbox'}"><b>${
        data.customerBalanceAfterMinor > 0 ? `Balance still owed: ${format(data.customerBalanceAfterMinor)}` : 'Fully paid. Thank you!'
      }</b></div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page{margin:0}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:${BRAND.text};font-family:Inter,Roboto,'Helvetica Neue',Arial,sans-serif;font-size:${compact ? 11 : 13}px;line-height:1.35}
.wrap{width:${compact ? '100%' : '520px'};margin:0 auto}
.bar{height:6px;background:linear-gradient(90deg,#2ECC71,${BRAND.green} 55%,${BRAND.greenDark})}
.in{padding:${compact ? '14px 16px 18px' : '28px 30px 30px'}}
.head{text-align:center}
.logo{width:52px;height:52px;border-radius:14px;object-fit:cover;margin:0 auto 8px;display:block}
.initial{background:${BRAND.tint};color:${BRAND.greenDark};font-weight:800;font-size:24px;line-height:52px;text-align:center}
.biz{font-size:${compact ? 16 : 20}px;font-weight:800;color:${BRAND.navy};letter-spacing:-.3px}
.contact{color:${BRAND.gray};font-size:${compact ? 10 : 12}px;margin-top:2px}
.hdr{color:${BRAND.gray};font-size:${compact ? 10 : 12}px;margin-top:6px}
.chip{display:inline-block;margin:12px 0 2px;background:${BRAND.blue};color:#fff;font-weight:700;font-size:${compact ? 10 : 12}px;padding:4px 12px;border-radius:999px;letter-spacing:.3px}
.dash{border-top:1.5px dashed ${BRAND.line};margin:12px 0}
table{width:100%;border-collapse:collapse}
td{padding:3px 0;vertical-align:top}
.k{color:${BRAND.gray};width:38%}.v{text-align:right;font-weight:600;color:${BRAND.navy}}
.h{font-size:${compact ? 9 : 11}px;font-weight:700;color:${BRAND.greenDark};letter-spacing:.8px;text-transform:uppercase;margin:0 0 4px}
.nm{font-weight:600;color:${BRAND.navy};padding-right:8px}
.sub{font-weight:400;color:${BRAND.gray};font-size:${compact ? 10 : 11.5}px}
.am{text-align:right;white-space:nowrap;font-weight:600}
.items td{padding:5px 0;border-bottom:1px solid #EEF2EF}
.disc td{color:${BRAND.greenDark}}
.total{display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px;padding:10px 12px;border-radius:12px;background:${BRAND.green};color:#fff;font-weight:800;font-size:${compact ? 15 : 18}px}
.credit{margin-top:10px;padding:9px 12px;border-radius:10px;background:${BRAND.amberBg};color:${BRAND.amberText};border:1px solid #F3DDA6}
.okbox{margin-top:10px;padding:9px 12px;border-radius:10px;background:${BRAND.tint};color:${BRAND.greenDark}}
.foot{text-align:center;color:${BRAND.gray};margin-top:6px;font-size:${compact ? 10 : 12}px}
.tagrow{text-align:center;margin-top:14px}
.tag{display:inline-block;border:1px solid ${BRAND.line};border-radius:999px;padding:5px 12px 5px 8px;background:#fff;color:${BRAND.gray};font-size:${compact ? 9 : 10.5}px;white-space:nowrap}
.tag img{vertical-align:middle}
.ti{width:${compact ? 16 : 20}px;height:${compact ? 16 : 20}px;margin-right:6px}
.tw{height:${compact ? 12 : 15}px;margin-left:4px;position:relative;top:1px}
</style></head><body><div class="wrap">
<div class="bar"></div>
<div class="in">
  <div class="head">
    ${logo}
    <div class="biz">${esc(business.name)}</div>
    ${business.address ? `<div class="contact">${esc(business.address)}</div>` : ''}
    ${business.phone ? `<div class="contact">Tel: ${esc(business.phone)}</div>` : ''}
    ${business.header ? `<div class="hdr">${esc(business.header)}</div>` : ''}
    <div class="chip">${isPayment ? 'PAYMENT RECEIPT' : 'RECEIPT'} ${esc(data.receiptNo)}</div>
  </div>
  <div class="dash"></div>
  <table>${meta}</table>
  ${isPayment ? '' : `<div class="dash"></div><div class="h">Items</div><table class="items">${items}</table>`}
  <div class="dash"></div>
  ${totals}
  ${paidBlock}
  ${payments ? `<div class="h" style="margin-top:10px">${isPayment ? 'Payment' : 'Paid with'}</div><table>${payments}${data.changeGivenMinor > 0 ? `<tr><td>Change given</td><td class="am">${format(data.changeGivenMinor)}</td></tr>` : ''}</table>` : ''}
  ${credit}${balanceAfter}
  <div class="dash"></div>
  <div class="foot">${esc(business.footer || 'Thank you for shopping with us!')}</div>
  <div class="tagrow"><span class="tag"><img class="ti" src="${MISHOP_ICON_DATA_URI}" alt="">Made with<img class="tw" src="${MISHOP_WORDMARK_DATA_URI}" alt="MiShop"></span></div>
</div>
</div></body></html>`;
}
