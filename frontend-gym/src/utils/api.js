import axios from 'axios';

// Detectar si estamos en localhost o en la red
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost 
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
      : (process.env.NEXT_PUBLIC_MOBILE_API_URL || 'http://192.168.2.104:3000');
  }
  // Fallback para server-side rendering
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
};

const api = axios.create({
  baseURL: `${getApiUrl()}/api`,
});

export default api;