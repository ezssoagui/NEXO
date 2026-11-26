import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { ToastProvider } from '@/components/toast';

export const metadata: Metadata = {
  title: { default: 'NEXO — preparação adaptativa para o ENEM', template: '%s · NEXO' },
  description: 'Rota de estudo adaptativa para o ENEM: questões oficiais, revisões, redação e mapa de domínio.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2563eb' };

// Aplica o tema antes da pintura (evita flash): cookie → preferência do dispositivo (10.4).
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )nexo_theme=(light|dark|system)/);var t=m?m[1]:'system';
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');document.documentElement.setAttribute('data-theme-pref',t);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const pref = jar.get('nexo_theme')?.value;
  return (
    <html lang="pt-BR" data-theme={pref === 'dark' ? 'dark' : 'light'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Pular para o conteúdo
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
