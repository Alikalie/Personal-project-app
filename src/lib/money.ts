export function parseSLEToMinorUnits(value: string): number {
  const input = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) {
    throw new Error('Enter a non-negative amount with up to 2 decimal places.');
  }

  const major = BigInt(match[1]);
  const minor = BigInt((match[2] ?? '').padEnd(2, '0'));
  const total = major * 100n + minor;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('The amount is too large.');
  }
  return Number(total);
}

let showDecimalsPreference = false;

export function setMoneyDisplayPreference(showDecimals: boolean) {
  showDecimalsPreference = showDecimals;
}

export function formatSLE(minorUnits: number, showDecimals = showDecimalsPreference) {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error('Money values must be safe integer minor units.');
  }
  const absolute = Math.abs(minorUnits);
  const majorUnits = showDecimals ? Math.floor(absolute / 100) : Math.floor((absolute + 50) / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  const formattedMajor = new Intl.NumberFormat('en-SL', {
    maximumFractionDigits: 0,
  }).format(majorUnits);
  const formatted = showDecimals ? `${formattedMajor}.${cents}` : formattedMajor;
  return `${minorUnits < 0 ? '-' : ''}Le ${formatted}`;
}
