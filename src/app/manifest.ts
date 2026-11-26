// ============================================================================
// SECCIÓN 1: MANIFEST PWA INSTALABLE EN ANDROID E iOS CON ÍCONOS PNG REALES
// ============================================================================

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'El Potrero Prode',
    short_name: 'Potrero Prode',
    description: 'Pronósticos privados de fútbol entre amigos',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b',
    theme_color: '#0d2117',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
