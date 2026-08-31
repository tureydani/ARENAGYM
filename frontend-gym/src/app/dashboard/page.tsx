'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TablaUsuarios from '../../components/TablaUsuarios';
import TablaAdministrativos from '../../components/TablaAdministrativos';
import TablaMembresias from '../../components/TablaMembresias';
import TablaRegistroMembresias from '../../components/TablaRegistroMembresias';
import TablaPagos from '../../components/TablaPagos';
import TablaProductos from '../../components/TablaProductos';
import TablaCajas from '../../components/TablaCajas';
import '../../styles/dashboard.css';

interface Admin {
  id_admin: number;
  nombre: string;
  apellido: string;
  usuario: string;
  fecha_contratacion: string;
}

export default function Dashboard() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [activeTab, setActiveTab] = useState('registros');
  const [showAdminPanels, setShowAdminPanels] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const adminData = sessionStorage.getItem('admin');
    if (!adminData) {
      router.push('/');
      return;
    }
    setAdmin(JSON.parse(adminData));
  }, [router]);

  const handleLogoClick = () => {
    setShowAdminPanels(!showAdminPanels);
    if (showAdminPanels && (activeTab === 'administrativos' || activeTab === 'membresias' || activeTab === 'productos' || activeTab === 'cajas')) {
      setActiveTab('registros');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin');
    router.push('/');
  };

  const showNotification = (message: string) => {
    setNotificationMessage(message);
    setShowSuccessNotification(true);
    setTimeout(() => {
      setShowSuccessNotification(false);
    }, 3000);
  };

  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-purple-300">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'registros', name: 'Registros', icon: '📋', description: 'Inscripciones activas' },
    { id: 'pagos', name: 'Pagos', icon: '💰', description: 'Gestión financiera' },
    { id: 'usuarios', name: 'Clientes', icon: '👥', description: 'Gestión de usuarios' },
    ...(showAdminPanels ? [
      { id: 'membresias', name: 'Membresías', icon: '🎯', description: 'Tipos de membresías' },
      { id: 'administrativos', name: 'Administrativos', icon: '👨‍💼', description: 'Administradores del sistema' },
      { id: 'productos', name: 'Productos', icon: '📦', description: 'Gestión de productos' },
      { id: 'cajas', name: 'Cajas', icon: '💳', description: 'Control de cajas registradoras' }
    ] : [])
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'registros':
        return <TablaRegistroMembresias />;
      case 'pagos':
        return <TablaPagos />;
      case 'usuarios':
        return <TablaUsuarios />;
      case 'administrativos':
        return <TablaAdministrativos />;
      case 'membresias':
        return <TablaMembresias />;
      case 'productos':
        return <TablaProductos />;
      case 'cajas':
        return <TablaCajas />;
      default:
        return <TablaRegistroMembresias />;
    }
  };

  return (
    <div className="dashboard-container gym-dashboard full-height">
      {showSuccessNotification && (
        <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 animate-slide-in-right w-auto max-w-sm">
          <div className="bg-green-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-lg flex items-center space-x-2 sm:space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-sm sm:text-base">✅ {notificationMessage}</p>
            </div>
            <button 
              onClick={() => setShowSuccessNotification(false)}
              className="ml-2 sm:ml-4 text-green-200 hover:text-white touch-target"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <header className="dashboard-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button 
                onClick={handleLogoClick}
                className="flex items-center space-x-2 sm:space-x-3 hover:bg-purple-800/20 p-1 sm:p-2 rounded-lg transition-all duration-300 group"
                title={showAdminPanels ? "Ocultar paneles administrativos" : "Mostrar paneles administrativos"}
              >
                <img 
                  src="/images/logo.png" 
                  alt="Arena Gym Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl shadow-lg object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <div 
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-600 to-cyan-400 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300"
                  style={{ display: 'none' }}
                >
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg sm:text-xl font-bold text-white group-hover:text-cyan-300 transition-colors duration-300">
                    ARENA GYM
                  </h1>
                  <p className="text-xs text-purple-300 group-hover:text-purple-200 transition-colors duration-300">
                    Sistema de Administración {showAdminPanels && '• Admin Panels'}
                  </p>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors duration-300">
                    ARENA
                  </h1>
                </div>
              </button>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-6">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-white">
                  {admin.nombre} {admin.apellido}
                </div>
                <div className="text-xs text-purple-300">
                  {admin.usuario}
                </div>
              </div>

              {/* Versión móvil del nombre del usuario */}
              <div className="text-right sm:hidden">
                <div className="text-xs font-medium text-white">
                  {admin.nombre}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Salir</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-purple-700/30 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {showAdminPanels && (
            <div className="text-center py-2 bg-purple-900/30 mb-2 rounded-lg">
              <span className="text-xs text-purple-300">
                🔐 Paneles Administrativos Activados - Haz clic en el logo para ocultar
              </span>
            </div>
          )}
          <nav className="flex flex-wrap gap-1 sm:gap-2 py-2 sm:py-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  dashboard-tab font-medium text-xs sm:text-sm transition-all duration-300 flex-shrink-0
                  ${activeTab === tab.id ? 'active' : ''}
                  ${(tab.id === 'administrativos' || tab.id === 'membresias' || tab.id === 'productos' || tab.id === 'cajas') ? 'ring-2 ring-purple-500/50' : ''}
                `}
              >
                <div className="flex items-center gap-1 sm:gap-3 w-full">
                  <span className="text-base sm:text-lg flex-shrink-0">{tab.icon}</span>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0 sm:mb-1">
                      <span className="font-semibold truncate text-xs sm:text-sm">{tab.name}</span>
                      {(tab.id === 'administrativos' || tab.id === 'membresias' || tab.id === 'productos' || tab.id === 'cajas') && (
                        <span className="text-xs bg-purple-600 text-white px-1 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold hidden sm:inline">ADMIN</span>
                      )}
                    </div>
                    <div className="text-xs opacity-75 leading-tight hidden sm:block">{tab.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
          <div className="mb-4 sm:mb-8">
            <div className="flex items-center justify-between flex-col sm:flex-row gap-4 sm:gap-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {tabs.find(tab => tab.id === activeTab)?.name}
                </h2>
                <p className="text-purple-300 mt-1 text-sm sm:text-base">
                  {tabs.find(tab => tab.id === activeTab)?.description}
                </p>
              </div>
              <div className="text-right text-xs sm:text-sm">
                <div className="text-purple-300">
                  Último acceso: {new Date().toLocaleDateString()}
                </div>
                <div className="text-gray-500 text-xs">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card gym-card rounded-xl sm:rounded-2xl overflow-hidden">
            {renderActiveComponent()}
          </div>
        </div>
      </main>

      <footer className="border-t border-purple-700/30 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto py-3 sm:py-6 px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center flex-col sm:flex-row gap-2 sm:gap-0">
            <div className="flex items-center space-x-4">
              <div className="text-xs sm:text-sm text-purple-300 text-center sm:text-left">
                © 2025 By Qescob. Sistema profesional de gestión.
              </div>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-6">
              <div className="text-xs text-gray-500">
                Versión 2.0.0
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Sistema activo</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}