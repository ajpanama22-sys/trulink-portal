import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import FondoCircuitos from '../components/FondoCircuitos';
import HeaderUser from '../components/HeaderUser';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Definir las rutas donde NO queremos que aparezca la tarjeta flotante del usuario
  const ocultarHeader = 
    router.pathname.startsWith('/admin') || 
    router.pathname === '/login' || 
    router.pathname.startsWith('/auth') ||
    router.pathname === '/';

  return (
    <>
      {/* El fondo interactivo se renderiza globalmente en todas las vistas */}
      <FondoCircuitos />

      {/* Tarjeta flotante del usuario en la esquina superior derecha para el cliente */}
      {!ocultarHeader && (
        <div style={{ position: 'fixed', top: '15px', right: '25px', zIndex: 9999 }}>
          <HeaderUser />
        </div>
      )}

      <Component {...pageProps} />
    </>
  );
}