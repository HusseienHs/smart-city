import { moduleMetadata, ModulePlaceholder } from '@/components/module-placeholder';

export function generateMetadata() {
  return moduleMetadata('auditLog');
}

export default function AuditLogPage() {
  return <ModulePlaceholder module="auditLog" />;
}
