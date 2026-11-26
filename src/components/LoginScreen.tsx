// ============================================================================
// SECCIÓN 1: IMPORTACIONES Y PROPS DE LA PANTALLA DE LOGIN CON GOOGLE
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LoginScreenProps {
  demoMode?: boolean;
  initialError?: string;
}

// ============================================================================
// SECCIÓN 2: PANTALLA DE ACCESO PRIVADO CON GOOGLE OAUTH (EL POTRERO PRODE)
// ============================================================================

export function LoginScreen({ demoMode = false, initialError }: LoginScreenProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>(initialError);

  async function handleGoogleLogin() {
    setLoading(true);
    setErrorCode(undefined);

    if (demoMode) {
      // Modo demo: permitimos acceso directo
      router.push('/');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorCode('auth_failed');
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-5 text-zinc-100">
      <div className="w-full max-w-sm rounded-3xl bg-[#0d2117] p-6 chalk-border">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <span className="text-2xl" aria-hidden="true">⚽</span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-400">
            Acceso Privado
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
            El Potrero Prode
          </h1>
          <p className="mt-1.5 text-sm text-zinc-300">
            Ingresá con tu cuenta de Google autorizada para cargar tus pronósticos.
          </p>
        </div>

        {errorCode && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border-zinc-600/40 bg-zinc-600/15 p-3.5 text-center text-sm font-semibold text-zinc-200"
          >
            <span className="font-bold text-amber-300">{initialError ?? 'Error'}</span>
            <p className="mt-1 text-xs text-zinc-300">{initialError ?? 'Ocurrió un error'} </p>
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleLogin}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-100 active:scale-[0.99] disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l4 3.1c.95-2.84 3.6-4.95 6.72-4.95Z"
            />
          </svg>
          {loading ? 'Verificando acceso...' : 'Ingresar con Google'}
        </button>
      </div>
    </main>
  );
}

export default LoginScreen;