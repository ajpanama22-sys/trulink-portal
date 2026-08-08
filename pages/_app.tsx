import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import FondoCircuitos from '../components/FondoCircuitos';
import HeaderUser from '../components/HeaderUser';
import InactivityGuard from '../components/InactivityGuard';
import { I18nProvider } from '../lib/i18n/LanguageContext';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isCapacitor, setIsCapacitor] = useState(false);

  useEffect(() => {
    // Detecta si estamos corriendo en una app nativa con Capacitor
    const isCap = typeof window !== 'undefined' && 
      (window as any).Capacitor !== undefined && 
      (window as any).Capacitor.isNativePlatform();
    setIsCapacitor(isCap);
  }, []);

  // En la web normal oculta el header en la raiz ('/'), pero en Android (Capacitor) lo deja libre para que los botones respondan
  const ocultarHeader = 
    router.pathname.startsWith('/admin') || 
    router.pathname === '/login' || 
    router.pathname.startsWith('/auth') ||
    (router.pathname === '/' && !isCapacitor);

  return (
    <I18nProvider>
      <FondoCircuitos />

      {!ocultarHeader && <InactivityGuard />}

      {!ocultarHeader && (
        <div style={{ position: 'fixed', bottom: '15px', right: '25px', zIndex: 9999 }}>
          <HeaderUser />
        </div>
      )}

      <Component {...pageProps} />
    </I18nProvider>
  );
}
