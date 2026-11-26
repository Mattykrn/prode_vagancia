// ============================================================================
// SECCIÓN 1: METADATA PWA, ÍCONOS Y VIEWPORT MOBILE-FIRST
// ============================================================================

import type { Metadata, Viewport } from 'next';
import { InstallPwaBanner } from '@/components/layout/InstallPwaBanner';
import { PwaRegister } from '@/components/layout/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prode Vagancia · Pronósticos de Fútbol',
  description: 'App privada de pronósticos de fútbol entre amigos',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Prode Vagancia',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d2117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};





// ============================================================================
// SECCIÓN 2: ROOT LAYOUT OSCURO GLOBAL CON REGISTRO DE SERVICE WORKER
// ============================================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <PwaRegister />
        <InstallPwaBanner />
        {children}
      </body>
    </html>
  );
}
