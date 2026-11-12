import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { friendlyErrorMessage } from '@/lib/errors';
import { newId } from '@/lib/uuid';
import { supabase } from '@/lib/supabase';

export type Product = {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_path: string | null;
  image_url: string | null;
  cost_price_minor: number;
  selling_price_minor: number;
  quantity: number;
  low_stock_threshold: number;
  deleted_at: string | null;
  category_name: string | null;
};

export type ProductInput = {
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  cost_price_minor: number;
  selling_price_minor: number;
  low_stock_threshold: number;
};

export type StockMovement = {
  id: string;
  product_id: string;
  product_name: string;
  type: string;
  quantity_change: number;
  quantity_after: number;
  reason: string;
  note: string | null;
  actor_name: string;
  created_at: string;
};

export type MovementFilter = {
  type?: string;
  startDate?: string;
  endDate?: string;
  productId?: string;
  page?: number;
  pageSize?: 20 | 30;
};

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The server returned an invalid product.');
  }
  return value as Record<string, unknown>;
}

function numberOf(value: unknown): number {
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('The server returned an invalid quantity or amount.');
  return result;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapProduct(value: unknown, categoryName: string | null, imageUrl: string | null): Product {
  const row = recordOf(value);
  if (typeof row.id !== 'string' || typeof row.business_id !== 'string' || typeof row.name !== 'string') {
    throw new Error('The server returned an invalid product.');
  }
  return {
    id: row.id,
    business_id: row.business_id,
    category_id: nullableText(row.category_id),
    name: row.name,
    sku: nullableText(row.sku),
    barcode: nullableText(row.barcode),
    image_path: nullableText(row.image_path),
    image_url: imageUrl,
    cost_price_minor: numberOf(row.cost_price_minor),
    selling_price_minor: numberOf(row.selling_price_minor),
    quantity: numberOf(row.quantity),
    low_stock_threshold: numberOf(row.low_stock_threshold),
    deleted_at: nullableText(row.deleted_at),
    category_name: categoryName,
  };
}

async function categoryNames(categoryIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(categoryIds)];
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('categories').select('id, name').in('id', ids);
  if (error) throw new Error(friendlyErrorMessage(error));
  return new Map((data ?? []).flatMap((category) =>
    typeof category.id === 'string' && typeof category.name === 'string'
      ? [[category.id, category.name] as const]
      : [],
  ));
}

async function enrichProducts(rows: unknown[]): Promise<Product[]> {
  const rawRows = rows.map(recordOf);
  const names = await categoryNames(rawRows.flatMap((row) =>
    typeof row.category_id === 'string' ? [row.category_id] : [],
  ));
  return Promise.all(rawRows.map(async (row) => {
    const categoryId = nullableText(row.category_id);
    const imagePath = nullableText(row.image_path);
    const imageUrl = imagePath ? await getImageUrl(imagePath) : null;
    return mapProduct(row, categoryId ? names.get(categoryId) ?? null : null, imageUrl);
  }));
}

export async function listProducts(
  businessId: string,
  options: { search?: string; categoryId?: string; lowStock?: boolean } = {},
): Promise<Product[]> {
  let lowStockIds: string[] | null = null;
  if (options.lowStock) {
    const { data, error } = await supabase
      .from('low_stock_products')
      .select('id')
      .eq('business_id', businessId);
    if (error) throw new Error(friendlyErrorMessage(error));
    lowStockIds = (data ?? []).flatMap((row) => typeof row.id === 'string' ? [row.id] : []);
    if (!lowStockIds.length) return [];
  }

  let query = supabase.from('products')
    .select('*')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (options.categoryId) query = query.eq('category_id', options.categoryId);
  if (lowStockIds) query = query.in('id', lowStockIds);
  const search = options.search?.trim().replace(/[%_,()]/g, ' ');
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw new Error(friendlyErrorMessage(error));
  return enrichProducts(data ?? []);
}

export async function getProduct(productId: string): Promise<Product> {
  const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return (await enrichProducts([data]))[0];
}

export async function createProduct(
  businessId: string,
  input: ProductInput,
  productId = newId(),
): Promise<Product> {
  const { data, error } = await supabase.from('products').insert({
    id: productId,
    business_id: businessId,
    ...input,
    quantity: 0,
    image_path: null,
  }).select('*').single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return mapProduct(data, null, null);
}

export async function updateProduct(productId: string, input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from('products')
    .update(input)
    .eq('id', productId)
    .select('*')
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return mapProduct(data, null, null);
}

export async function softDeleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) throw new Error(friendlyErrorMessage(error));
}

export async function adjustStock(
  businessId: string,
  productId: string,
  type: 'opening' | 'stock_in' | 'stock_out' | 'adjustment' | 'return',
  quantity: number,
  reason: string,
): Promise<number> {
  if (!Number.isSafeInteger(quantity) || quantity === 0) {
    throw new Error('Enter a valid non-zero whole-number quantity.');
  }
  if (type !== 'adjustment' && quantity < 1) {
    throw new Error('Enter a positive quantity.');
  }
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_business_id: businessId,
    p_product_id: productId,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason,
  });
  if (error) throw new Error(friendlyErrorMessage(error));
  const result = numberOf(data);
  return result;
}

export async function listMovements(
  businessId: string,
  filter: MovementFilter = {},
): Promise<{ rows: StockMovement[]; total: number }> {
  const page = Math.max(0, filter.page ?? 0);
  const pageSize = filter.pageSize ?? 30;
  const queryMovements = async (typeColumn: 'type' | 'movement_type') => {
    let query = supabase.from('stock_movements')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (filter.type) query = query.eq(typeColumn, filter.type);
    if (filter.productId) query = query.eq('product_id', filter.productId);
    if (filter.startDate) query = query.gte('created_at', `${filter.startDate}T00:00:00`);
    if (filter.endDate) {
      const nextDay = new Date(`${filter.endDate}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query = query.lt('created_at', nextDay.toISOString());
    }
    return query;
  };
  let result = await queryMovements('type');
  if (
    result.error
    && filter.type
    && result.error.code === '42703'
    && /column .*type.* does not exist/i.test(result.error.message)
  ) {
    result = await queryMovements('movement_type');
  }
  const { data, count, error } = result;
  if (error) throw new Error(friendlyErrorMessage(error));
  const movementRows = (data ?? []).map(recordOf);
  const productIds = [...new Set(movementRows.flatMap((row) =>
    typeof row.product_id === 'string' ? [row.product_id] : [],
  ))];
  const actorIds = [...new Set(movementRows.flatMap((row) => {
    const id = row.created_by ?? row.user_id;
    return typeof id === 'string' ? [id] : [];
  }))];
  const [products, actors] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id, name').in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (products.error) throw new Error(friendlyErrorMessage(products.error));
  if (actors.error) throw new Error(friendlyErrorMessage(actors.error));
  const productNames = new Map((products.data ?? []).flatMap((row) =>
    typeof row.id === 'string' && typeof row.name === 'string' ? [[row.id, row.name] as const] : [],
  ));
  const actorNames = new Map((actors.data ?? []).flatMap((row) =>
    typeof row.id === 'string' && typeof row.full_name === 'string' ? [[row.id, row.full_name] as const] : [],
  ));

  return {
    total: count ?? 0,
    rows: movementRows.map((row, index) => {
      const productId = typeof row.product_id === 'string' ? row.product_id : '';
      const type = String(row.type ?? row.movement_type ?? 'adjustment');
      const rawQuantity = numberOf(row.quantity_change ?? row.quantity_delta ?? row.quantity ?? 0);
      const change = type === 'stock_out' && rawQuantity > 0 ? -rawQuantity : rawQuantity;
      const actorId = typeof (row.created_by ?? row.user_id) === 'string'
        ? String(row.created_by ?? row.user_id)
        : '';
      return {
        id: typeof row.id === 'string' ? row.id : `${productId}-${index}`,
        product_id: productId,
        product_name: productNames.get(productId) ?? 'Deleted product',
        type,
        quantity_change: change,
        quantity_after: numberOf(row.quantity_after ?? row.stock_after ?? 0),
        reason: typeof row.reason === 'string' ? row.reason : '',
        note: nullableText(row.note),
        actor_name: actorNames.get(actorId) ?? 'Team member',
        created_at: typeof row.created_at === 'string' ? row.created_at : '',
      };
    }),
  };
}

export async function listLowStock(businessId: string): Promise<Product[]> {
  const { data, error } = await supabase.from('low_stock_products')
    .select('*')
    .eq('business_id', businessId)
    .order('quantity', { ascending: true });
  if (error) throw new Error(friendlyErrorMessage(error));
  const products = await enrichProducts(data ?? []);
  return products.sort((a, b) =>
    a.quantity * b.low_stock_threshold - b.quantity * a.low_stock_threshold,
  );
}

export async function getProductCount(businessId: string): Promise<number> {
  const { count, error } = await supabase.from('products')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .is('deleted_at', null);
  if (error) throw new Error(friendlyErrorMessage(error));
  return count ?? 0;
}

export async function getLowStockCount(businessId: string): Promise<number> {
  const { count, error } = await supabase.from('low_stock_products')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (error) throw new Error(friendlyErrorMessage(error));
  return count ?? 0;
}

export async function getStockValuation(businessId: string): Promise<number> {
  const { data, error } = await supabase.from('products')
    .select('quantity, cost_price_minor')
    .eq('business_id', businessId)
    .is('deleted_at', null);
  if (error) throw new Error(friendlyErrorMessage(error));
  return (data ?? []).reduce((value, row) => {
    const quantity = numberOf(row.quantity);
    const cost = numberOf(row.cost_price_minor);
    const next = value + quantity * cost;
    if (!Number.isSafeInteger(next)) throw new Error('The stock valuation exceeds the supported range.');
    return next;
  }, 0);
}

const imageUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function clearProductImageCache() {
  imageUrlCache.clear();
}

export async function uploadProductImage(
  localUri: string,
  businessId: string,
  productId: string,
): Promise<string> {
  const image = await ImageManipulator.manipulate(localUri, { maxWidth: 800, maxHeight: 800 });
  const rendered = await image.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  const base64 = await new File(result.uri).base64();
  const path = `${businessId}/${productId}.jpg`;
  const { error } = await supabase.storage.from('product-images').upload(path, decode(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(friendlyErrorMessage(error));
  imageUrlCache.delete(path);
  return path;
}

export async function getImageUrl(imagePath: string): Promise<string | null> {
  const cached = imageUrlCache.get(imagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from('product-images').createSignedUrl(imagePath, 60 * 60);
  if (error) throw new Error(friendlyErrorMessage(error));
  imageUrlCache.set(imagePath, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function updateProductImagePath(productId: string, imagePath: string): Promise<void> {
  const { error } = await supabase.from('products')
    .update({ image_path: imagePath })
    .eq('id', productId);
  if (error) throw new Error(friendlyErrorMessage(error));
}
