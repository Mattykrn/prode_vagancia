// ============================================================================
// SECCIÓN 1: MIDDLEWARE PARA REFRESCAR SESIÓN SUPABASE EN CADA PETICIÓN
// ============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  // The createServerSupabaseClient already handles the key fallback
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si hay usuario, refrescamos las cookies para persistir la sesión
  // después del callback de OAuth
  if (user) {
    // Forzamos una actualización suave de la sesión
    const { error } = await supabase.auth.getSession();

    if (error) {
      // No interrumpimos el request, solo loggeamos
      console.error('Error refrescando sesión en middleware:', error.message);
    }
  }

  // Continuar con el request
  return NextResponse.next();
}

// Configurar el matcher para que se ejecube en todas las rutas
export const config = {
  matcher: ['/'],
};