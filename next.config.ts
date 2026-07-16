module.exports = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/productos',
        permanent: true,
      },
    ]
  },
}
