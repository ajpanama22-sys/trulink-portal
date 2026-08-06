import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import FondoCircuitos from '../components/FondoCircuitos';
import HeaderUser from '../components/HeaderUser';
import InactivityGuard from '../components/InactivityGuard';

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

  // En la web normal oculta el header en la raíz ('/'), pero en Android (Capacitor) lo deja libre para que los botones respondan
  const ocultarHeader = 
    router.pathname.startsWith('/admin') || 
    router.pathname === '/login' || 
    router.pathname.startsWith('/auth') ||
    (router.pathname === '/' && !isCapacitor);

  return (
    <>
      {/* TrustedSite — verificación de sitio, carga en todas las páginas */}
      <Script
        src="https://cdn.ywxi.net/js/1.js"
        strategy="afterInteractive"
        async
      />

      <FondoCircuitos />

      {!ocultarHeader && <InactivityGuard />}

      {!ocultarHeader && (
        <div style={{ position: 'fixed', bottom: '15px', right: '25px', zIndex: 9999 }}>
          <HeaderUser />
        </div>
      )}

      <Component {...pageProps} />
    </>
  );
}