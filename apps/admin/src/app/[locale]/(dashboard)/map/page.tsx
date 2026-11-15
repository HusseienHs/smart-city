import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('map');
}

export default function MapPage() {
  return <ModulePlaceholder module="map" />;
}
