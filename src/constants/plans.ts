import type { PlanId } from '@/constants/subscription';

export type Plan = {
  id: PlanId;
  name: string;
  features: string[];
};

export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    features: ['Sales and receipts', 'Product and stock tracking', 'Customer balances'],
  },
  {
    id: 'business',
    name: 'Business',
    features: ['Everything in Starter', 'Team access', 'Sales and stock history'],
  },
  {
    id: 'pro',
    name: 'Pro',
    features: ['Everything in Business', 'Advanced reports', 'Priority support'],
  },
];
