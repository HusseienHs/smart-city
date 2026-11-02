import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-10 py-8">{children}</main>
    </div>
  );
}
