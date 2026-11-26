// ============================================================================
// SECCIÓN 1: CLIENTE SUPABASE PARA COMPONENTES DEL NAVEGADOR
// ============================================================================

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase no está configurado. Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (o PUBLISHABLE_KEY).');
  }

  return createBrowserClient(url, anonKey);
}

