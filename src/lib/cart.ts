export type CartItem = {
  productId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  maxStock: number;
  originalPriceMinor: number;
};

export type CartDiscount =
  | { kind: 'fixed'; value: number }
  | { kind: 'percentage'; value: number }
  | null;

export type CartTotals = {
  subtotal: number;
  discount: number;
  total: number;
};

export function calculatePercentageDiscount(subtotalMinor: number, percentBasisPoints: number): number {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new Error('Subtotal must be non-negative integer minor units.');
  }
  if (!Number.isSafeInteger(percentBasisPoints) || percentBasisPoints < 0 || percentBasisPoints > 10000) {
    throw new Error('Percentage must be from 0 to 100.');
  }
  return Number((BigInt(subtotalMinor) * BigInt(percentBasisPoints)) / 10000n);
}

export function calculateCartTotals(items: CartItem[], discount: CartDiscount): CartTotals {
  const subtotal = items.reduce((sum, item) => {
    if (
      !Number.isSafeInteger(item.unitPriceMinor)
      || item.unitPriceMinor < 0
      || !Number.isSafeInteger(item.quantity)
      || item.quantity < 1
      || item.quantity > item.maxStock
    ) {
      throw new Error(`Invalid cart quantity or price for ${item.name}.`);
    }
    const next = BigInt(sum) + BigInt(item.unitPriceMinor) * BigInt(item.quantity);
    if (next > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Cart total is too large.');
    return Number(next);
  }, 0);

  const requestedDiscount = discount
    ? discount.kind === 'fixed'
      ? discount.value
      : calculatePercentageDiscount(subtotal, discount.value)
    : 0;
  if (!Number.isSafeInteger(requestedDiscount) || requestedDiscount < 0 || requestedDiscount > subtotal) {
    throw new Error('Discount cannot exceed the subtotal.');
  }
  return { subtotal, discount: requestedDiscount, total: subtotal - requestedDiscount };
}

export function calculateCashChange(amountReceivedMinor: number, amountDueMinor: number): {
  appliedMinor: number;
  changeMinor: number;
} {
  if (
    !Number.isSafeInteger(amountReceivedMinor)
    || amountReceivedMinor < 0
    || !Number.isSafeInteger(amountDueMinor)
    || amountDueMinor < 0
  ) {
    throw new Error('Cash received and amount due must be non-negative integer minor units.');
  }
  const appliedMinor = Math.min(amountReceivedMinor, amountDueMinor);
  return { appliedMinor, changeMinor: amountReceivedMinor - appliedMinor };
}

export function parsePercentToBasisPoints(input: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) throw new Error('Enter a percentage with up to 2 decimal places.');
  const basisPoints = Number(BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')));
  if (!Number.isSafeInteger(basisPoints) || basisPoints > 10000) {
    throw new Error('Percentage must be between 0 and 100.');
  }
  return basisPoints;
}

// Examples: two 1,000-minor items total 2,000; a fixed 250 discount leaves 1,750.
// A 12.34% discount on 10,001 minor units floors to 123; fixed discounts over subtotal throw.
// Cash of 1,200 against 1,000 due applies 1,000 and gives 200 change.
// Rounding: 1 minor unit * 50% => 0; 3 minor units * 50% => 1.
