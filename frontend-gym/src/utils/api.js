import axios from 'axios';

// La API ahora vive en la misma app de Next.js (rutas bajo /api), por lo que
// usamos una baseURL relativa: mismo origen, sin configuración de host/puerto.
const api = axios.create({
  baseURL: '/api',
});

export default api;
