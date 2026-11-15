import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LockKeyhole, ShieldCheck, ShieldOff } from 'lucide-react-native';

import { useAuth } from '@/components/AuthProvider';
import { AdminCard, AdminError, AdminLoading, AdminScreen, AdminStatusBadge, adminRowDate } from '@/components/admin/AdminUi';
import { Button, Field } from '@/components/ui';
import { colors, radius, Spacing, typography } from '@/constants/theme';
import { friendlyErrorMessage } from '@/lib/errors';
import { canManageAdmins } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { listAdminAudit, type AdminAuditEntry } from '@/services/adminService';
import { listAppSettings, saveAppSetting, type AppSettingRow } from '@/services/contentService';

type TotpEnrollment = { factorId: string; secret: string; qrCode: string };

export default function AdminSecurityScreen() {
  const { ctx } = useAuth();
  const isSuperAdmin = canManageAdmins(ctx?.platformAdminLevel);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState<AdminAuditEntry[]>([]);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [requireMfa, setRequireMfa] = useState(false);
  const [mfaSetting, setMfaSetting] = useState<AppSettingRow | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [factorsResult, aalResult, userResult, auditRows, settings] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.getUser(),
        listAdminAudit(3, 0),
        listAppSettings(),
      ]);
      if (factorsResult.error) throw factorsResult.error;
      if (aalResult.error) throw aalResult.error;
      if (userResult.error) throw userResult.error;
      const verifiedTotp = factorsResult.data.totp.find((factor) => factor.status === 'verified');
      setFactorId(verifiedTotp?.id ?? null);
      setCurrentLevel(aalResult.data.currentLevel);
      setLastSignIn(userResult.data.user.last_sign_in_at ?? null);
      setActivity(auditRows);
      const setting = settings.find((item) => item.key === 'admin_require_mfa') ?? null;
      setMfaSetting(setting);
      setRequireMfa(setting?.value === true || (
        typeof setting?.value === 'object'
        && setting.value !== null
        && 'value' in setting.value
        && setting.value.value === true
      ));
    } catch (loadError) {
      setError(friendlyErrorMessage(loadError, 'admin'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const enroll = async () => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MiShop admin authenticator',
        issuer: 'MiShop',
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        factorId: data.id,
        secret: data.totp.secret,
        qrCode: data.totp.qr_code,
      });
      setCode('');
    } catch (enrollError) {
      setActionError(friendlyErrorMessage(enrollError, 'admin'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!enrollment || busy) return;
    const trimmedCode = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(trimmedCode)) {
      setActionError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: trimmedCode,
      });
      if (verifyError) throw verifyError;
      setEnrollment(null);
      setCode('');
      await load();
    } catch (verifyError) {
      setActionError(friendlyErrorMessage(verifyError, 'admin'));
    } finally {
      setBusy(false);
    }
  };

  const setGlobalRequirement = async (required: boolean) => {
    if (!isSuperAdmin || !mfaSetting || busy) return;
    if (required && currentLevel !== 'aal2') {
      setActionError('Verify your authenticator code in this session before requiring two-step sign-in for everyone.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await saveAppSetting({
        ...mfaSetting,
        value: required,
      });
      setRequireMfa(required);
      setMfaSetting({ ...mfaSetting, value: required });
    } catch (saveError) {
      setActionError(friendlyErrorMessage(saveError, 'admin'));
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = () => {
    if (!factorId || busy) return;
    Alert.alert(
      'Remove two-step sign-in?',
      'This removes the authenticator from your account. The security setting must be turned off first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void confirmRemoveFactor() },
      ],
    );
  };

  const confirmRemoveFactor = async () => {
    if (!factorId || busy) return;
    if (password.length < 6) {
      setActionError('Enter your password to remove the authenticator.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = userData.user.email;
      if (!email) throw new Error('The signed-in account does not have an email address.');
      const { error: reauthError } = await supabase.auth.reauthenticate();
      if (reauthError) throw reauthError;
      const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password });
      if (passwordError) throw passwordError;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      setPassword('');
      await load();
    } catch (removeError) {
      setActionError(friendlyErrorMessage(removeError, 'admin'));
    } finally {
      setBusy(false);
    }
  };

  const signOutAllDevices = () => {
    Alert.alert(
      'Sign out of all devices?',
      'You will need to sign in again on every device using this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out everywhere', style: 'destructive', onPress: () => void performGlobalSignOut() },
      ],
    );
  };

  const performGlobalSignOut = async () => {
    setBusy(true);
    setActionError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setActionError(friendlyErrorMessage(signOutError, 'admin'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AdminScreen title="Security center"><AdminLoading rows={5} /></AdminScreen>;
  }

  return (
    <AdminScreen title="Security center" subtitle="Protect your admin account and platform">
      {error ? <AdminError message={error} onRetry={() => void load()} /> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AdminCard>
            <View style={styles.statusHeading}>
              <View style={styles.statusIcon}>
                {factorId ? <ShieldCheck size={22} color={colors.primaryDark} /> : <ShieldOff size={22} color={colors.textSecondary} />}
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.cardTitle}>Two-step sign-in</Text>
                <Text style={styles.cardBody}>
                  {factorId ? 'An authenticator app is connected to this admin account.' : 'Add an authenticator app to protect this admin account.'}
                </Text>
              </View>
              <AdminStatusBadge label={factorId ? 'Enabled' : 'Not set up'} tone={factorId ? 'success' : 'warning'} />
            </View>
            <Text style={styles.meta}>Current session: {currentLevel === 'aal2' ? 'Verified with two steps' : 'Password sign-in'}</Text>
            {factorId ? (
              <>
                {!requireMfa ? (
                  <View style={styles.passwordBox}>
                    <Field label="Password to remove two-step sign-in" value={password} onChangeText={setPassword} secureTextEntry editable={!busy} />
                  </View>
                ) : null}
                {isSuperAdmin && !requireMfa ? (
                  <Button
                    label="Remove two-step sign-in"
                    variant="outline"
                    onPress={removeFactor}
                    disabled={busy || password.length < 6}
                  />
                ) : null}
              </>
            ) : enrollment ? (
              <View style={styles.enrollment}>
                <Text style={styles.cardBody}>Scan this QR code with your authenticator app, or enter the secret key manually.</Text>
                <Image
                  source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qrCode)}` }}
                  style={styles.qrCode}
                  accessibilityLabel="Authenticator setup QR code"
                />
                <Text selectable style={styles.secret}>{enrollment.secret}</Text>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.codeInput}
                  accessibilityLabel="Authenticator verification code"
                />
                <Button label="Verify and enable" onPress={() => void verify()} loading={busy} disabled={busy || code.length !== 6} />
                <Button label="Cancel setup" variant="outline" onPress={() => setEnrollment(null)} disabled={busy} />
              </View>
            ) : (
              <Button label="Set up two-step sign-in" onPress={() => void enroll()} loading={busy} disabled={busy} />
            )}
          </AdminCard>

          <AdminCard>
            <Text style={styles.cardTitle}>Admin-wide two-step sign-in</Text>
            <Text style={styles.cardBody}>Require every platform admin to verify an authenticator when accessing admin tools. You must verify your own authenticator first.</Text>
            {mfaSetting ? (
              <View style={styles.switchRow}>
                <Text style={styles.cardBody}>{requireMfa ? 'Required for all admins' : 'Optional for admins'}</Text>
                <Switch
                  value={requireMfa}
                  onValueChange={(value) => void setGlobalRequirement(value)}
                  disabled={!isSuperAdmin || busy || (!requireMfa && currentLevel !== 'aal2')}
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel="Require two-step sign-in for all admins"
                />
              </View>
            ) : (
              <Text style={styles.meta}>The admin_require_mfa setting is unavailable. Ask a super admin to check app settings.</Text>
            )}
            {!isSuperAdmin ? <Text style={styles.meta}>Only super admins can change this setting.</Text> : null}
          </AdminCard>

          <AdminCard>
            <Text style={styles.cardTitle}>Session security</Text>
            <SecurityLine label="Idle sign-out" value="15 minutes of inactivity" />
            <SecurityLine label="Background protection" value="Sign out after 5 minutes away" />
            <SecurityLine label="Password for risky actions" value="Re-enter before sensitive changes" />
            <SecurityLine label="Last sign-in" value={lastSignIn ? adminRowDate(lastSignIn) : 'Not available'} />
          </AdminCard>

          <AdminCard>
            <Text style={styles.cardTitle}>Role permissions</Text>
            <PermissionLine role="Support" permissions="View platform data, read support sessions, review audit activity." />
            <PermissionLine role="Super admin" permissions="Manage admins, publish legal content, export emails and open approved write sessions." />
            <PermissionLine role="Cashier" permissions="No access to platform admin tools or support data sessions." />
          </AdminCard>

          <AdminCard>
            <Text style={styles.cardTitle}>Recent admin activity</Text>
            {activity.length === 0 ? <Text style={styles.meta}>No recent admin activity.</Text> : activity.map((entry) => (
              <View key={entry.id} style={styles.activityRow}>
                <Text style={styles.activityText}>{auditSentence(entry.action)}</Text>
                <Text style={styles.meta}>{adminRowDate(entry.created_at)}</Text>
              </View>
            ))}
          </AdminCard>

          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          <Pressable
            onPress={signOutAllDevices}
            style={styles.signOut}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Sign out of all devices"
            accessibilityState={{ disabled: busy }}
          >
            <LockKeyhole size={18} color={colors.danger} />
            <Text style={styles.signOutText}>Sign out of all devices</Text>
          </Pressable>
        </ScrollView>
      )}
    </AdminScreen>
  );
}

function SecurityLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.securityLine}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

function PermissionLine({ role, permissions }: { role: string; permissions: string }) {
  return (
    <View style={styles.permissionLine}>
      <Text style={styles.permissionRole}>{role}</Text>
      <Text style={styles.cardBody}>{permissions}</Text>
    </View>
  );
}

function auditSentence(action: string): string {
  const descriptions: Record<string, string> = {
    support_start: 'Started a support access session',
    support_end: 'Ended a support access session',
    cms_create: 'Created platform content',
    cms_update: 'Updated platform content',
    cms_publish: 'Published platform content',
    delete_business: 'Deleted a business',
    update_profile: 'Updated a user profile',
    export_emails: 'Exported opted-in email addresses',
    grant_admin: 'Granted platform admin access',
    revoke_admin: 'Revoked platform admin access',
    suspend_user: 'Changed a user suspension status',
    suspend_business: 'Changed a business suspension status',
  };
  const normalized = action.toLowerCase();
  return descriptions[normalized] ?? normalized.replace(/[_-]+/g, ' ');
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.seven },
  statusHeading: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  statusIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.primaryLight },
  statusCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.text, ...typography.heading },
  cardBody: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  meta: { color: colors.textSecondary, ...typography.caption },
  passwordBox: { marginTop: Spacing.three },
  enrollment: { gap: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
  qrCode: { width: 190, height: 190, backgroundColor: colors.white },
  secret: { color: colors.text, ...typography.label, textAlign: 'center' },
  codeInput: { width: '100%', minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: Spacing.three, backgroundColor: colors.white, color: colors.text, textAlign: 'center', letterSpacing: 4, fontSize: 20 },
  switchRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, marginTop: Spacing.two },
  securityLine: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, borderTopWidth: 1, borderTopColor: colors.border },
  lineLabel: { color: colors.textSecondary, ...typography.caption },
  lineValue: { color: colors.text, ...typography.label, flexShrink: 1, textAlign: 'right' },
  permissionLine: { gap: Spacing.one, paddingVertical: Spacing.three, borderTopWidth: 1, borderTopColor: colors.border },
  permissionRole: { color: colors.primaryDark, ...typography.label },
  activityRow: { gap: Spacing.one, paddingVertical: Spacing.three, borderTopWidth: 1, borderTopColor: colors.border },
  activityText: { color: colors.text, ...typography.label },
  actionError: { color: colors.danger, ...typography.caption },
  signOut: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.white },
  signOutText: { color: colors.danger, ...typography.label },
});
