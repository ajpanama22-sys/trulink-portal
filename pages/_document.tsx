import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        {/* TrustedSite — script embebido en el HTML servido, para que el verificador lo detecte */}
        <script
          type="text/javascript"
          src="https://cdn.ywxi.net/js/1.js"
          async
        ></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
