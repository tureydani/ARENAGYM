import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // 🔹 Sequelize/pg usan require() dinámico según el dialecto configurado;
  // si el bundler los empaqueta pierden esa resolución en runtime
  // ("Please install pg package manually"). Los mantenemos como
  // dependencias externas para que se resuelvan normalmente desde
  // node_modules en el entorno serverless.
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore'],

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
