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

/* Iconos SVG inline (estilo Heroicons outline) */
const IconClipboardList = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconBanknotes = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m-7-5a7 7 0 1114 0 7 7 0 01-14 0z" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3.999-4M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2h14z" />
  </svg>
);

const IconFlag = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4h12l-1.5 4L15 12H3" />
  </svg>
);

const IconIdentification = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM9 10a2 2 0 11-4 0 2 2 0 014 0zM6 16c0-1.657 1.567-3 3.5-3M13 8h5M13 12h5M13 16h5" />
  </svg>
);

const IconArchiveBox = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l1.447-2.894A2 2 0 016.236 4h11.528a2 2 0 011.789 1.106L21 8M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8M3 8h18M10 12h4" />
  </svg>
);

const IconCreditCard = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 6h16.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z" />
  </svg>
);

const IconLockClosed = () => (
  <svg className="w-4 h-4 inline-block align-text-bottom mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const IconCheckCircle = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5 inline-block align-text-bottom mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconLogout = () => (
  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-slate-500">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'registros', name: 'Registros', icon: <IconClipboardList />, description: 'Inscripciones activas' },
    { id: 'pagos', name: 'Pagos', icon: <IconBanknotes />, description: 'Gestión financiera' },
    { id: 'usuarios', name: 'Clientes', icon: <IconUsers />, description: 'Gestión de usuarios' },
    ...(showAdminPanels ? [
      { id: 'membresias', name: 'Membresías', icon: <IconFlag />, description: 'Tipos de membresías' },
      { id: 'administrativos', name: 'Administrativos', icon: <IconIdentification />, description: 'Administradores del sistema' },
      { id: 'productos', name: 'Productos', icon: <IconArchiveBox />, description: 'Gestión de productos' },
      { id: 'cajas', name: 'Cajas', icon: <IconCreditCard />, description: 'Control de cajas registradoras' }
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
          <div className="bg-emerald-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-lg flex items-center space-x-2 sm:space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-sm sm:text-base flex items-center"><IconCheckCircle /> {notificationMessage}</p>
            </div>
            <button
              onClick={() => setShowSuccessNotification(false)}
              className="ml-2 sm:ml-4 text-emerald-100 hover:text-white touch-target"
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
                className="flex items-center space-x-2 sm:space-x-3 hover:bg-slate-100 p-1 sm:p-2 rounded-lg transition-colors duration-200 group"
                title={showAdminPanels ? "Ocultar paneles administrativos" : "Mostrar paneles administrativos"}
              >
                <img
                  src="/images/logo.png"
                  alt="Arena Gym Logo"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl shadow-sm object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center"
                  style={{ display: 'none' }}
                >
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                    ARENA GYM
                  </h1>
                  <p className="text-xs text-slate-500">
                    Sistema de Administración {showAdminPanels && '• Admin Panels'}
                  </p>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-lg font-bold text-slate-900">
                    ARENA
                  </h1>
                </div>
              </button>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-6">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-slate-900">
                  {admin.nombre} {admin.apellido}
                </div>
                <div className="text-xs text-slate-500">
                  {admin.usuario}
                </div>
              </div>

              {/* Versión móvil del nombre del usuario */}
              <div className="text-right sm:hidden">
                <div className="text-xs font-medium text-slate-900">
                  {admin.nombre}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200"
              >
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <IconLogout />
                  <span className="hidden sm:inline">Salir</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {showAdminPanels && (
            <div className="text-center py-2 bg-indigo-50 mb-2 rounded-lg">
              <span className="text-xs text-indigo-700 inline-flex items-center">
                <IconLockClosed /> Paneles Administrativos Activados - Haz clic en el logo para ocultar
              </span>
            </div>
          )}
          <nav className="flex flex-wrap gap-1 sm:gap-2 py-2 sm:py-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  dashboard-tab font-medium text-xs sm:text-sm flex-shrink-0
                  ${activeTab === tab.id ? 'active' : ''}
                `}
              >
                <div className="flex items-center gap-1 sm:gap-3 w-full">
                  <span className="flex-shrink-0">{tab.icon}</span>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0 sm:mb-1">
                      <span className="font-semibold truncate text-xs sm:text-sm">{tab.name}</span>
                      {(tab.id === 'administrativos' || tab.id === 'membresias' || tab.id === 'productos' || tab.id === 'cajas') && (
                        <span className="text-xs bg-indigo-600 text-white px-1 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold hidden sm:inline">ADMIN</span>
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
        <div className="max-w-7xl mx-auto py-3 sm:py-4 px-3 sm:px-6 lg:px-8">
          <div className="dashboard-card gym-card rounded-xl sm:rounded-2xl overflow-hidden">
            {renderActiveComponent()}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto py-3 sm:py-6 px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center flex-col sm:flex-row gap-2 sm:gap-0">
            <div className="flex items-center space-x-4">
              <div className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
                © 2025 By Qescob. Sistema profesional de gestión.
              </div>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-6">
              <div className="text-xs text-slate-400">
                Versión 2.0.0
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Sistema activo</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
