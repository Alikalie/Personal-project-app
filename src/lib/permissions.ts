export type BusinessRole = 'owner' | 'manager' | 'cashier';
export type PlatformAdminLevel = 'super_admin' | 'support';

export function isBusinessRole(role: string | null | undefined): role is BusinessRole {
  return role === 'owner' || role === 'manager' || role === 'cashier';
}

export function canEditBusiness(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

export function canManageBilling(role: string | null | undefined): boolean {
  return role === 'owner';
}

export function isPlatformAdmin(level: string | null | undefined): level is PlatformAdminLevel {
  return level === 'super_admin' || level === 'support';
}

export function canManageAdmins(level: string | null | undefined): boolean {
  return level === 'super_admin';
}

export function canWriteSupportData(level: string | null | undefined, writeSession: boolean): boolean {
  return level === 'super_admin' && writeSession;
}

export function canExportEmails(level: string | null | undefined): boolean {
  return level === 'super_admin';
}

export function canPublishLegal(level: string | null | undefined): boolean {
  return level === 'super_admin';
}
