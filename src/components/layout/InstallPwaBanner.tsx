// ============================================================================
// SECCIÓN 1: TIPOS Y DETECCIÓN DE INSTALACIÓN PWA (ANDROID CHROME E iOS SAFARI)
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}





// ============================================================================
// SECCIÓN 2: COMPONENTE DE BANNER PARA DESCARGAR / INSTALAR LA APP EN EL CELULAR
// ============================================================================

export function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);

    if (isIos && isSafari) {
      setShowIosHint(true);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (dismissed || (!deferredPrompt && !showIosHint)) {
    return null;
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  return (
    <div className="border-b border-emerald-500/30 bg-[#0d2117] px-4 py-2 text-xs text-emerald-100">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
        {deferredPrompt ? (
          <>
            <span className="font-semibold">📲 Instalá Prode Vagancia en tu celular</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className="rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-black text-zinc-950"
              >
                Instalar App
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-1.5 text-zinc-400"
                aria-label="Ocultar aviso"
              >
                ✕
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="font-semibold">
              📲 En iPhone: tocá <strong>Compartir</strong> →{' '}
              <strong>Agregar a inicio</strong> para instalarla
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-1.5 text-zinc-400"
              aria-label="Ocultar aviso"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

