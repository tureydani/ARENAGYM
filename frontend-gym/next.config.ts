import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 🔹 Permitir acceso desde cualquier host en la red local
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
