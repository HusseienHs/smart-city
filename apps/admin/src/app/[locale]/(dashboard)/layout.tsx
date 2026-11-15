import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
