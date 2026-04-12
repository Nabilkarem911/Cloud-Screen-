import { redirect } from 'next/navigation';
import { AdminSectionShell } from './admin-section-shell';
import { fetchAuthMeServer } from '@/lib/server-auth';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminSectionLayout({ children, params }: Props) {
  const { locale } = await params;
  const me = await fetchAuthMeServer();
  if (!me.authenticated) {
    redirect(
      `/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/admin`)}`,
    );
  }
  if (!me.isSuperAdmin) {
    redirect(`/${locale}/overview`);
  }
  return <AdminSectionShell>{children}</AdminSectionShell>;
}
