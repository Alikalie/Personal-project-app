export function formatSLE(value: number) {
  return new Intl.NumberFormat('en-SL', {
    style: 'currency',
    currency: 'SLL',
    maximumFractionDigits: 0,
  }).format(value);
}
