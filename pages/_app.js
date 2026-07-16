import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {/* Sello Premium */}
      <img src="/images/premium.png" alt="Premium Seal" className="premium-seal" />
    </>
  )
}

export default MyApp
