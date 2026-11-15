import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('account');
}

export default function AccountPage() {
  return <ModulePlaceholder module="account" />;
}
