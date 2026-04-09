'use client';

import { SuperAdminGuard } from '@/features/admin/super-admin-guard';

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminGuard>{children}</SuperAdminGuard>;
}
