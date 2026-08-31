import axios from 'axios';

// La API ahora vive en la misma app de Next.js (rutas bajo /api), por lo que
// usamos una baseURL relativa: mismo origen, sin configuración de host/puerto.
const api = axios.create({
  baseURL: '/api',
});

// Adjunta el token de sesión del administrativo (guardado al hacer login en
// LoginForm) a cada petición, igual que hace la app móvil con el suyo.
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Si el token expiró o es inválido, el servidor responde 401: cerramos la
// sesión local y mandamos de vuelta al login en vez de dejar la pantalla en
// un estado a medias con peticiones fallando en silencio.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      sessionStorage.removeItem('admin');
      sessionStorage.removeItem('adminToken');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
