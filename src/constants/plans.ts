export type Plan = {
  name: string;
  monthlyPriceMinor: number;
  features: string[];
};

export const plans: Plan[] = [
  {
    name: 'Starter',
    monthlyPriceMinor: 0,
    features: ['Sales and receipts', 'Product and stock tracking', 'Customer balances'],
  },
  {
    name: 'Business',
    monthlyPriceMinor: 0,
    features: ['Everything in Starter', 'Team access', 'Sales and stock history'],
  },
  {
    name: 'Pro',
    monthlyPriceMinor: 0,
    features: ['Everything in Business', 'Advanced reports', 'Priority support'],
  },
];
