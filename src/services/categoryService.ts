import { friendlyErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type Category = {
  id: string;
  business_id: string;
  name: string;
  deleted_at: string | null;
};

function mapCategory(value: unknown): Category {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The server returned an invalid category.');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.business_id !== 'string' || typeof row.name !== 'string') {
    throw new Error('The server returned an invalid category.');
  }
  return {
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
  };
}

export async function listCategories(businessId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, business_id, name, deleted_at')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw new Error(friendlyErrorMessage(error));
  return (data ?? []).map(mapCategory);
}

export async function createCategory(businessId: string, name: string): Promise<Category> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Enter a category name.');
  const { data, error } = await supabase
    .from('categories')
    .insert({ business_id: businessId, name: normalizedName })
    .select('id, business_id, name, deleted_at')
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return mapCategory(data);
}

export async function updateCategory(categoryId: string, name: string): Promise<Category> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Enter a category name.');
  const { data, error } = await supabase
    .from('categories')
    .update({ name: normalizedName })
    .eq('id', categoryId)
    .select('id, business_id, name, deleted_at')
    .single();
  if (error) throw new Error(friendlyErrorMessage(error));
  return mapCategory(data);
}

export async function softDeleteCategory(category: Category): Promise<void> {
  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', category.id)
    .is('deleted_at', null);
  if (countError) throw new Error(friendlyErrorMessage(countError));
  if ((count ?? 0) > 0) {
    throw new Error('This category still has products. Move or delete those products before removing the category.');
  }
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', category.id);
  if (error) throw new Error(friendlyErrorMessage(error));
}
