/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/mega/:path*',
        destination: '/api/mega',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/mega/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
