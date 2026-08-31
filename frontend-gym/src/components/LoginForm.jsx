'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../styles/login.css';

export default function LoginForm() {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // La API vive en la misma app de Next.js (mismo origen), así que
      // usamos una ruta relativa en vez de un host/puerto separado.
      const res = await fetch('/api/administrativos');

      if (!res.ok) {
        throw new Error('Error al conectar con el servidor');
      }

      const admins = await res.json();

      const found = admins.find(
        (a) => a.usuario === usuario && a.contraseña === contraseña
      );

      if (found) {
        sessionStorage.setItem('admin', JSON.stringify(found));
        router.push('/dashboard');
      } else {
        setError('Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container flex items-center justify-center">
      {/* Elementos flotantes decorativos */}
      <div className="login-floating-elements">
        <div className="floating-shape w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-500"></div>
        <div className="floating-shape w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 to-green-500"></div>
        <div className="floating-shape w-24 h-24 rounded-full bg-gradient-to-r from-purple-900 to-purple-600"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto p-3 sm:p-6">
        <div className="login-card rounded-xl sm:rounded-2xl p-6 sm:p-8 relative">
          {/* Header con logo y título */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mb-3 sm:mb-4">
              <img 
                src="/images/logo.png" 
                alt="Arena Gym Logo" 
                className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-xl sm:rounded-2xl shadow-lg object-cover"
                onError={(e) => {
                  // Si la imagen no se encuentra, mostrar el SVG como fallback con el diseño original
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div 
                className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-purple-600 to-cyan-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg"
                style={{ display: 'none' }}
              >
                <svg 
                  className="w-8 h-8 sm:w-10 sm:h-10 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h2 className="login-title text-2xl sm:text-3xl font-bold mb-2">
              ARENA GYM
            </h2>
            <p className="text-purple-300 text-xs sm:text-sm font-medium">
              Sistema de Administración
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label htmlFor="usuario" className="block text-sm font-medium text-purple-300 mb-2">
                  Usuario
                </label>
                <input
                  id="usuario"
                  type="text"
                  className="login-input w-full p-3 sm:p-4 rounded-lg sm:rounded-xl text-base"
                  placeholder="Ingresa tu usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="contraseña" className="block text-sm font-medium text-purple-300 mb-2">
                  Contraseña
                </label>
                <input
                  id="contraseña"
                  type="password"
                  className="login-input w-full p-3 sm:p-4 rounded-lg sm:rounded-xl text-base"
                  placeholder="Ingresa tu contraseña"
                  value={contraseña}
                  onChange={(e) => setContraseña(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              className="login-button w-full p-3 sm:p-4 rounded-lg sm:rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Iniciando sesión...
                </div>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>
          
          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-xl backdrop-blur-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            </div>
          )}
          
          
        </div>
      </div>
    </div>
  );
}