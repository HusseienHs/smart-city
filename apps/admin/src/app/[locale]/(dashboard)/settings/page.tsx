import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('settings');
}

export default function SettingsPage() {
  return <ModulePlaceholder module="settings" />;
}
