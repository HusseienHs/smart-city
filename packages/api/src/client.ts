import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

/**
 * The typed client every API function receives. Each app creates its own (AsyncStorage session
 * on mobile, cookie session in the dashboard), always with the publishable key, so all queries
 * run as the signed-in user and Row Level Security applies. Never pass a service-role client.
 */
export type SmartCityClient = SupabaseClient<Database>;
