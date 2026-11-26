// ============================================================================
// SECCIÓN 1: REGISTRO DEL SERVICE WORKER PARA PWA EN NAVEGADORES MÓVILES
// ============================================================================

'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return null;
}

