import { supabase } from '../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EffectiveFlightControl, FlightControlCatalogItem } from '../../types/flightControls';

const PUBLIC_COLUMNS = [
  'id',
  'kind',
  'slug',
  'name',
  'description',
  'icon_name',
  'default_enabled',
  'sort_order',
  'mcp_allowed_tools',
  'mcp_auto_approve_tools',
].join(',');

export async function getFlightControls(userId?: string | null): Promise<EffectiveFlightControl[]> {
  const { data: catalog, error: catalogError } = await supabase
    .from('flight_control_catalog')
    .select(PUBLIC_COLUMNS)
    .order('sort_order', { ascending: true });

  if (catalogError) throw catalogError;

  let preferences: Array<{ catalog_id: string; enabled: boolean }> = [];
  if (userId) {
    const { data, error } = await supabase
      .from('user_flight_control_settings')
      .select('catalog_id,enabled')
      .eq('user_id', userId);
    if (error) throw error;
    preferences = data || [];
  }

  const preferenceMap = new Map(preferences.map(item => [item.catalog_id, item.enabled]));
  return ((catalog || []) as unknown as FlightControlCatalogItem[]).map(item => ({
    ...item,
    enabled: userId ? (preferenceMap.get(item.id) ?? item.default_enabled) : item.default_enabled,
  }));
}

export async function setFlightControlEnabled(
  userId: string,
  catalogId: string,
  enabled: boolean,
): Promise<void> {
  const untypedClient = supabase as unknown as SupabaseClient;
  const { error } = await untypedClient
    .from('user_flight_control_settings')
    .upsert({ user_id: userId, catalog_id: catalogId, enabled }, { onConflict: 'user_id,catalog_id' });
  if (error) throw error;
}
