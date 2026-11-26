// ============================================================================
// SECCIÓN 1: NAVEGACIÓN INFERIOR MOBILE-FIRST (ESTILO APP NATIVA)
// ============================================================================

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavProps {
  isAdmin: boolean;
  demoMode: boolean;
}

export function BottomNav({ isAdmin, demoMode }: BottomNavProps) {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Prode', icon: '⚽' },
    { href: '/ranking', label: 'Posiciones', icon: '🏆' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: '🛠️' }] : []),
    { href: '/login', label: demoMode ? 'Login Demo' : 'Cuenta', icon: '👤' },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/90 bg-zinc-950/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-xl items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

