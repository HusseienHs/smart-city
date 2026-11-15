import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('analytics');
}

export default function AnalyticsPage() {
  return <ModulePlaceholder module="analytics" />;
}
