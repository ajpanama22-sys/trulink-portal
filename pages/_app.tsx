import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import FondoCircuitos from '../components/FondoCircuitos';
import HeaderUser from '../components/HeaderUser';
import InactivityGuard from '../components/InactivityGuard';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Definir las rutas donde NO queremos que aparezca la tarjeta flotante del usuario
  // ni que corra el cierre de sesión por inactividad (admin tiene su propia
  // lógica de sesión, y login/auth/raíz son públicas, sin sesión de cliente activa).
  const ocultarHeader = 
    router.pathname.startsWith('/admin') || 
    router.pathname === '/login' || 
    router.pathname.startsWith('/auth') ||
    router.pathname === '/';

  return (
    <>
      {/* El fondo interactivo se renderiza globalmente en todas las vistas */}
      <FondoCircuitos />

      {/* Cierre de sesión por inactividad (5 min), centralizado para todo
          el portal de clientes — antes solo vivía dentro de fabricacion.tsx. */}
      {!ocultarHeader && <InactivityGuard />}

      {/* Tarjeta flotante del usuario, fija abajo a la derecha para no tapar
          los botones de "Volver al Portal" / "Cerrar Sesión" que suelen
          estar arriba en cada página. */}
      {!ocultarHeader && (
        <div style={{ position: 'fixed', bottom: '15px', right: '25px', zIndex: 9999 }}>
          <HeaderUser />
        </div>
      )}

      <Component {...pageProps} />
    </>
  );
}
