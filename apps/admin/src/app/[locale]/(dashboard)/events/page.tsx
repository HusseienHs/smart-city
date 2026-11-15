import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('events');
}

export default function EventsPage() {
  return <ModulePlaceholder module="events" />;
}
