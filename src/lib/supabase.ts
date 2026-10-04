import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True once you've pasted a project URL + anon key into .env.local. Sync is a no-op until then. */
export const supabaseConfigured = !!url && !!anonKey;

export const supabase = supabaseConfigured ? createClient(url!, anonKey!) : null;
