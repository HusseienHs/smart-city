import { Redirect } from 'expo-router';

/**
 * Events have no backend yet. The route stays so old links keep working and forwards to
 * Updates, where municipal announcements (including events) are published.
 */
export default function EventsScreen() {
  return <Redirect href="/notices" />;
}
