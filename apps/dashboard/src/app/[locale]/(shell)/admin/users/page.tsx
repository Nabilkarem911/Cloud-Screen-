import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

/** Legacy route — consolidated into Customers hub. */
export default async function AdminUsersRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/admin/customers`);
}
