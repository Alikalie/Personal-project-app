const currencyDigits: Record<string, number> = {
  SLE: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  LRD: 2,
  GHS: 2,
  NGN: 2,
  GMD: 2,
  XOF: 0,
  XAF: 0,
  KES: 2,
  ZAR: 2,
};

let defaultCurrencyCode = 'SLE';
let showDecimalsPreference = false;

export function setDefaultCurrencyCode(currencyCode: string | null) {
  defaultCurrencyCode = currencyCode || 'SLE';
}

function digitsFor(currencyCode: string): number {
  const known = currencyDigits[currencyCode];
  if (known !== undefined) return known;
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode })
    .resolvedOptions().maximumFractionDigits ?? 2;
  if (!Number.isInteger(digits) || digits < 0 || digits > 3) throw new Error('Unsupported currency precision.');
  return digits;
}

export function currencyFractionDigits(currencyCode: string): number {
  return digitsFor(currencyCode);
}

export function parseMoneyToMinorUnits(value: string, currencyCode = defaultCurrencyCode): number {
  const digits = digitsFor(currencyCode);
  const pattern = digits === 0 ? /^(\d+)$/ : new RegExp(`^(\\d+)(?:\\.(\\d{1,${digits}}))?$`);
  const match = pattern.exec(value.trim());
  if (!match) {
    throw new Error(`Enter a non-negative amount with up to ${digits} decimal places.`);
  }

  const major = BigInt(match[1]);
  const factor = 10n ** BigInt(digits);
  const minor = digits === 0 ? 0n : BigInt((match[2] ?? '').padEnd(digits, '0'));
  const total = major * factor + minor;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('The amount is too large.');
  }
  return Number(total);
}

export function parseSLEToMinorUnits(value: string): number {
  return parseMoneyToMinorUnits(value.trim().replace(/^Le\s*/i, ''), 'SLE');
}

export function setMoneyDisplayPreference(showDecimals: boolean) {
  showDecimalsPreference = showDecimals;
}

export function formatMoney(minorUnits: number, currencyCode = defaultCurrencyCode, showDecimals = showDecimalsPreference) {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error('Money values must be safe integer minor units.');
  }
  const digits = digitsFor(currencyCode);
  const factor = 10n ** BigInt(digits);
  const absolute = BigInt(Math.abs(minorUnits));
  const roundedMajor = showDecimals || digits === 0
    ? absolute / factor
    : (absolute + factor / 2n) / factor;
  const signedMajor = minorUnits < 0 ? -roundedMajor : roundedMajor;
  const formatter = new Intl.NumberFormat('en-SL', currencyCode === 'SLE'
    ? { maximumFractionDigits: 0 }
    : { style: 'currency', currency: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const parts = formatter.formatToParts(Number(signedMajor));
  if (showDecimals && digits > 0) {
    const decimal = new Intl.NumberFormat('en-SL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      .formatToParts(1).find((part) => part.type === 'decimal')?.value ?? '.';
    const lastNumberPart = parts.reduce((last, part, index) =>
      part.type === 'integer' || part.type === 'group' ? index : last, -1);
    parts.splice(lastNumberPart + 1, 0,
      { type: 'decimal', value: decimal },
      { type: 'fraction', value: String(absolute % factor).padStart(digits, '0') });
  }
  const formatted = parts.map((part) => part.value).join('');
  if (currencyCode === 'SLE') {
    const absoluteParts = formatter.formatToParts(Number(roundedMajor));
    if (showDecimals && digits > 0) {
      const decimal = new Intl.NumberFormat('en-SL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        .formatToParts(1).find((part) => part.type === 'decimal')?.value ?? '.';
      const lastNumberPart = absoluteParts.reduce((last, part, index) =>
        part.type === 'integer' || part.type === 'group' ? index : last, -1);
      absoluteParts.splice(lastNumberPart + 1, 0,
        { type: 'decimal', value: decimal },
        { type: 'fraction', value: String(absolute % factor).padStart(digits, '0') });
    }
    return `${minorUnits < 0 ? '-' : ''}Le ${absoluteParts.map((part) => part.value).join('')}`;
  }
  return formatted;
}

export function formatSLE(minorUnits: number, showDecimals = showDecimalsPreference) {
  return formatMoney(minorUnits, defaultCurrencyCode, showDecimals);
}
