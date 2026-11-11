import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';

import {
  calculateCartTotals,
  type CartDiscount,
  type CartItem,
} from '@/lib/cart';
import { newId } from '@/lib/uuid';

type CartState = {
  items: CartItem[];
  discount: CartDiscount;
  customer: { id: string; name: string; phone: string | null } | null;
  saleId: string | null;
};

type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'quantity' | 'originalPriceMinor'> }
  | { type: 'quantity'; productId: string; quantity: number }
  | { type: 'price'; productId: string; unitPriceMinor: number }
  | { type: 'remove'; productId: string }
  | { type: 'discount'; discount: CartDiscount }
  | { type: 'customer'; customer: CartState['customer'] }
  | { type: 'checkout-start'; saleId: string }
  | { type: 'clear' };

const initialState: CartState = { items: [], discount: null, customer: null, saleId: null };

function reducer(state: CartState, action: CartAction): CartState {
  if (state.saleId && action.type !== 'clear') return state;
  switch (action.type) {
    case 'add': {
      const current = state.items.find((item) => item.productId === action.item.productId);
      if (current) {
        return {
          ...state,
          items: state.items.map((item) => item.productId === action.item.productId
            ? { ...item, quantity: Math.min(item.maxStock, item.quantity + 1) }
            : item),
        };
      }
      return {
        ...state,
        items: [...state.items, {
          ...action.item,
          quantity: 1,
          originalPriceMinor: action.item.unitPriceMinor,
        }],
      };
    }
    case 'quantity':
      return {
        ...state,
        items: state.items.map((item) => item.productId === action.productId
          ? { ...item, quantity: Math.max(1, Math.min(item.maxStock, action.quantity)) }
          : item),
      };
    case 'price':
      return {
        ...state,
        items: state.items.map((item) => item.productId === action.productId
          ? { ...item, unitPriceMinor: action.unitPriceMinor }
          : item),
      };
    case 'remove':
      return { ...state, items: state.items.filter((item) => item.productId !== action.productId) };
    case 'discount':
      return { ...state, discount: action.discount };
    case 'customer':
      return { ...state, customer: action.customer };
    case 'checkout-start':
      return state.saleId ? state : { ...state, saleId: action.saleId };
    case 'clear':
      return initialState;
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  discount: CartDiscount;
  customer: CartState['customer'];
  saleId: string | null;
  locked: boolean;
  totals: ReturnType<typeof calculateCartTotals>;
  addItem: (item: Omit<CartItem, 'quantity' | 'originalPriceMinor'>) => { added: boolean; message?: string };
  setQuantity: (productId: string, quantity: number) => { changed: boolean; message?: string };
  setPrice: (productId: string, priceMinor: number) => void;
  removeItem: (productId: string) => void;
  setDiscount: (discount: CartDiscount) => void;
  setCustomer: (customer: CartState['customer']) => void;
  ensureSaleId: () => string;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saleIdRef = useRef<string | null>(null);
  const totals = useMemo(() => calculateCartTotals(state.items, state.discount), [state.items, state.discount]);

  const addItem: CartContextValue['addItem'] = useCallback((item) => {
    const existing = state.items.find((line) => line.productId === item.productId);
    if (state.saleId) return { added: false, message: 'This sale is being confirmed. Retry or finish it before changing the cart.' };
    if (!existing && item.maxStock < 1) return { added: false, message: 'This product is out of stock.' };
    if (existing && existing.quantity >= existing.maxStock) {
      return { added: false, message: `Only ${existing.maxStock} units of ${existing.name} are available.` };
    }
    dispatch({ type: 'add', item });
    return { added: true };
  }, [state.items, state.saleId]);

  const setQuantity: CartContextValue['setQuantity'] = useCallback((productId, quantity) => {
    const item = state.items.find((line) => line.productId === productId);
    if (!item) return { changed: false };
    if (state.saleId) return { changed: false, message: 'This sale is being confirmed. Retry or finish it before changing the cart.' };
    if (quantity > item.maxStock) {
      return { changed: false, message: `Only ${item.maxStock} units of ${item.name} are available.` };
    }
    dispatch({ type: 'quantity', productId, quantity });
    return { changed: true };
  }, [state.items, state.saleId]);

  const setPrice = useCallback((productId: string, unitPriceMinor: number) => {
    if (state.saleId || !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) return;
    dispatch({ type: 'price', productId, unitPriceMinor });
  }, [state.saleId]);
  const removeItem = useCallback((productId: string) => {
    if (!state.saleId) dispatch({ type: 'remove', productId });
  }, [state.saleId]);
  const setDiscount = useCallback((discount: CartDiscount) => {
    if (!state.saleId) dispatch({ type: 'discount', discount });
  }, [state.saleId]);
  const setCustomer = useCallback((customer: CartState['customer']) => {
    if (!state.saleId) dispatch({ type: 'customer', customer });
  }, [state.saleId]);

  const ensureSaleId = useCallback(() => {
    if (state.saleId) return state.saleId;
    if (saleIdRef.current) return saleIdRef.current;
    const id = newId();
    saleIdRef.current = id;
    dispatch({ type: 'checkout-start', saleId: id });
    return id;
  }, [state.saleId]);

  const clearCart = useCallback(() => {
    saleIdRef.current = null;
    dispatch({ type: 'clear' });
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    items: state.items,
    discount: state.discount,
    customer: state.customer,
    saleId: state.saleId,
    locked: state.saleId !== null,
    totals,
    addItem,
    setQuantity,
    setPrice,
    removeItem,
    setDiscount,
    setCustomer,
    ensureSaleId,
    clearCart,
  }), [
    state.items,
    state.discount,
    state.customer,
    state.saleId,
    totals,
    addItem,
    setQuantity,
    setPrice,
    removeItem,
    setDiscount,
    setCustomer,
    ensureSaleId,
    clearCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider.');
  return context;
}
