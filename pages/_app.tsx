import type { AppProps } from 'next/app';
import FondoCircuitos from '../components/FondoCircuitos';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* El fondo interactivo se renderiza globalmente en todas las vistas */}
      <FondoCircuitos />
      <Component {...pageProps} />
    </>
  );
}