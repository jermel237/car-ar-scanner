/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=self, xr-spatial-tracking=self',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;