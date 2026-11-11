import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Pencil, Plus, Tag, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/ds';
import { useAuth } from '@/components/AuthProvider';
import { colors, radius, shadow } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import {
  createCategory,
  listCategories,
  softDeleteCategory,
  updateCategory,
  type Category,
} from '@/services/categoryService';

export default function Categories() {
  const { ctx } = useAuth();
  const businessId = ctx?.businessId;
  const canWrite = ['owner', 'manager'].includes(ctx?.business?.role?.toLowerCase() ?? '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      setError('Your business is not available.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setCategories(await listCategories(businessId));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [businessId]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!businessId || !name.trim() || saving || !canWrite) {
      if (!name.trim()) setError('Enter a category name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = editing
        ? await updateCategory(editing.id, name)
        : await createCategory(businessId, name);
      setCategories((items) => editing
        ? items.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.name.localeCompare(b.name))
        : [...items, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setEditing(null);
    } catch (saveError) {
      setError(friendlyErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = (category: Category) => {
    Alert.alert('Delete category?', `${category.name} will be removed from active categories.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          setError('');
          void softDeleteCategory(category)
            .then(() => setCategories((items) => items.filter((item) => item.id !== category.id)))
            .catch((deleteError: unknown) => setError(friendlyErrorMessage(deleteError)))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}><ScreenHeader title="Categories" subtitle="Organise products by type" onBack={() => router.back()} /></View>

      {canWrite && (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>{editing ? 'Rename category' : 'Add a category'}</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Category name" placeholderTextColor={colors.textSecondary} style={styles.input} returnKeyType="done" onSubmitEditing={() => void submit()} />
          <View style={styles.editorButtons}>
            {editing && <Pressable onPress={() => { setEditing(null); setName(''); }} style={styles.cancel}><X size={20} color={colors.textSecondary} /></Pressable>}
            <View style={{ flex: 1 }}><Button label={editing ? 'Save name' : 'Add category'} onPress={() => void submit()} loading={saving} disabled={saving} /></View>
          </View>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Loading categories...</Text></View>
      ) : categories.length === 0 ? (
        <View style={styles.state}><Text style={styles.emptyTitle}>No categories yet</Text><Text style={styles.subtitle}>{canWrite ? 'Add a category to group related products.' : 'Categories created for your business will appear here.'}</Text></View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={() => void load()}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.tagIcon}><Tag size={18} color={colors.primary} /></View>
              <Text style={styles.categoryName}>{item.name}</Text>
              {canWrite && (
                <>
                  <Pressable onPress={() => { setEditing(item); setName(item.name); setError(''); }} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Rename ${item.name}`}><Pencil size={18} color={colors.primary} /></Pressable>
                  <Pressable onPress={() => remove(item)} disabled={saving} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} accessibilityState={{ disabled: saving }}><Trash2 size={18} color={colors.danger} /></Pressable>
                </>
              )}
            </View>
          )}
        />
      )}
      {!canWrite && <Text style={styles.readOnly}>You have read-only category access.</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  subtitle: { color: colors.textSecondary, marginTop: 5, textAlign: 'center', lineHeight: 20, fontSize: 13 },
  editor: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, marginHorizontal: 20, marginTop: 4, marginBottom: 8, ...shadow },
  editorTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.background },
  editorButtons: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  cancel: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: 13 },
  error: { color: colors.danger, paddingHorizontal: 18, paddingVertical: 8, textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 12, gap: 8 },
  tagIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  categoryName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  readOnly: { color: colors.textSecondary, textAlign: 'center', padding: 12 },
});
