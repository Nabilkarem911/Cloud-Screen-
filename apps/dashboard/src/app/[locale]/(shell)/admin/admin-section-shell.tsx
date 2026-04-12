'use client';

import { SuperAdminGuard } from '@/features/admin/super-admin-guard';

export function AdminSectionShell({ children }: { children: React.ReactNode }) {
  return <SuperAdminGuard>{children}</SuperAdminGuard>;
}
