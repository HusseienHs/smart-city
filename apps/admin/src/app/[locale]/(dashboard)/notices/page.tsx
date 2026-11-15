import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('notices');
}

export default function NoticesPage() {
  return <ModulePlaceholder module="notices" />;
}
