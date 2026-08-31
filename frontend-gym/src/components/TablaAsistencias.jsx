'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../utils/api';
import { SearchBar } from './ui';
import ModalCalendarioAsistencias from './ModalCalendarioAsistencias';
import '../styles/tables.css';
import '../styles/modals.css';

const QR_REGION_ID = 'asistencias-qr-reader';
const RESUME_DELAY_MS = 2500;

// Formatea una fecha ISO como "hace X minutos" (o fecha/hora legible si es muy antigua)
const formatearTiempoRelativo = (fechaIso) => {
  if (!fechaIso) return 'N/A';
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return 'N/A';

  const segundos = Math.floor((Date.now() - fecha.getTime()) / 1000);

  if (segundos < 5) return 'justo ahora';
  if (segundos < 60) return `hace ${segundos} segundos`;

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} hora${horas === 1 ? '' : 's'}`;

  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} día${dias === 1 ? '' : 's'}`;

  return fecha.toLocaleString();
};

export default function TablaAsistencias() {
  // --- Escaneo QR ---
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null); // instancia de Html5Qrcode
  const isProcessingRef = useRef(false); // evita registrar el mismo frame varias veces
  const resumeTimeoutRef = useRef(null);

  // --- Resultado compartido (escaneo o marcado manual) ---
  const [resultado, setResultado] = useState(null); // { tipo: 'success' | 'warning' | 'error', mensaje, usuario }

  // --- Marcado manual ---
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [marcando, setMarcando] = useState(false);

  // --- Asistencias recientes ---
  const [recientes, setRecientes] = useState([]);
  const [loadingRecientes, setLoadingRecientes] = useState(false);
  const [errorRecientes, setErrorRecientes] = useState('');

  // --- Modal de calendario de asistencias de un cliente puntual ---
  const [usuarioCalendario, setUsuarioCalendario] = useState(null); // { id_usuario, nombre, apellido } | null

  const fetchUsuarios = useCallback(async () => {
    setLoadingUsuarios(true);
    try {
      const res = await api.get('/usuarios');
      const data = Array.isArray(res.data) ? res.data : [];
      setUsuarios(data.filter((u) => u.activo !== false));
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    } finally {
      setLoadingUsuarios(false);
    }
  }, []);

  const fetchRecientes = useCallback(async () => {
    setLoadingRecientes(true);
    try {
      const res = await api.get('/asistencias/recientes?limite=20');
      setRecientes(Array.isArray(res.data) ? res.data : []);
      setErrorRecientes('');
    } catch (err) {
      console.error('Error al cargar asistencias recientes:', err);
      setErrorRecientes('No se pudo cargar la lista de asistencias recientes');
    } finally {
      setLoadingRecientes(false);
    }
  }, []);

  const detenerEscaneo = useCallback(async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) {
      try {
        await instance.stop();
        instance.clear();
      } catch (err) {
        // La cámara puede ya estar detenida; no es un error crítico.
        console.warn('No se pudo detener la cámara limpiamente:', err);
      }
    }
    setIsScanning(false);
  }, []);

  // Carga inicial de datos
  useEffect(() => {
    fetchUsuarios();
    fetchRecientes();
  }, [fetchUsuarios, fetchRecientes]);

  // Limpieza de recursos de cámara al desmontar el componente
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      const instance = scannerRef.current;
      if (instance) {
        instance.stop().then(() => instance.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const registrarAsistencia = async (payload) => {
    try {
      const res = await api.post('/asistencias/registrar', payload);
      const { usuario, duplicado, message } = res.data;
      setResultado({
        tipo: duplicado ? 'warning' : 'success',
        mensaje:
          message ||
          (duplicado
            ? 'El cliente ya tenía una asistencia registrada hace poco'
            : 'Asistencia registrada correctamente'),
        usuario
      });
      fetchRecientes();
      return true;
    } catch (err) {
      const mensaje = err.response?.data?.error || 'Error al registrar la asistencia';
      setResultado({ tipo: 'error', mensaje, usuario: err.response?.data?.usuario });
      return false;
    }
  };

  const onScanSuccess = async (decodedText) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      if (scannerRef.current) {
        await scannerRef.current.pause(true);
      }
    } catch (err) {
      // Ignorar: puede que ya esté pausado
    }

    await registrarAsistencia({ qrToken: decodedText });

    resumeTimeoutRef.current = setTimeout(() => {
      isProcessingRef.current = false;
      setResultado(null);
      try {
        if (scannerRef.current) {
          scannerRef.current.resume();
        }
      } catch (err) {
        // El escaneo pudo haberse detenido manualmente mientras tanto
      }
    }, RESUME_DELAY_MS);
  };

  const iniciarEscaneo = async () => {
    setCameraError('');
    setResultado(null);
    if (scannerRef.current) return;

    const html5Qrcode = new Html5Qrcode(QR_REGION_ID);
    scannerRef.current = html5Qrcode;

    try {
      await html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {} // Ignorar fallos de decodificación por frame (normal mientras no hay QR en cuadro)
      );
      setIsScanning(true);
    } catch (err) {
      console.error('Error al iniciar la cámara:', err);
      setCameraError(
        'No se pudo acceder a la cámara. Verifica que el navegador tenga permiso o que exista una cámara disponible. Puedes usar el marcado manual mientras tanto.'
      );
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  // --- Marcado manual ---
  const filteredUsuarios = searchTerm.trim()
    ? usuarios
        .filter((u) => {
          const term = searchTerm.toLowerCase().trim();
          const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
          return nombreCompleto.includes(term);
        })
        .slice(0, 8)
    : [];

  const handleSeleccionarUsuario = (usuario) => {
    setSelectedUsuario(usuario);
    setSearchTerm(`${usuario.nombre} ${usuario.apellido}`);
  };

  const handleMarcarManual = async () => {
    if (!selectedUsuario || marcando) return;
    setMarcando(true);
    setResultado(null);
    await registrarAsistencia({ id_usuario: selectedUsuario.id_usuario });
    setMarcando(false);
    setSelectedUsuario(null);
    setSearchTerm('');
  };

  const resultAlertClass =
    resultado?.tipo === 'success'
      ? 'alert-success'
      : resultado?.tipo === 'warning'
      ? 'alert-warning'
      : 'alert-error';

  return (
    <div className="table-container h-full flex flex-col relative">
      {/* Header */}
      <div className="table-header flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="table-title">Control de Asistencias</h2>
          <span className="text-sm text-slate-500">Escaneo por QR y marcado manual</span>
        </div>
        <div className="table-actions">
          <button
            onClick={fetchRecientes}
            disabled={loadingRecientes}
            className="btn-secondary flex items-center gap-2"
          >
            {loadingRecientes ? (
              <div className="loading-spinner w-4 h-4"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refrescar
          </button>
        </div>
      </div>

      {/* Resultado del último registro (escaneo o manual) */}
      {resultado && (
        <div className={`mx-6 mt-4 alert ${resultAlertClass}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {resultado.tipo === 'error' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                ) : resultado.tipo === 'warning' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <span>
                {resultado.usuario && (
                  <strong>
                    {resultado.usuario.nombre} {resultado.usuario.apellido}:{' '}
                  </strong>
                )}
                {resultado.mensaje}
              </span>
            </div>
            <button
              onClick={() => setResultado(null)}
              className="text-current opacity-70 hover:opacity-100 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sección escaneo QR */}
        <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-base font-semibold text-slate-900">Escanear código QR</h3>
          <p className="text-sm text-slate-500">
            Usa la cámara para escanear el código QR que el cliente muestra en su app móvil.
          </p>

          <div className="flex gap-2">
            <button
              onClick={iniciarEscaneo}
              disabled={isScanning}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h4M3 4v4M3 4l6 6m12-9a1 1 0 011 1v4m-1-5h-4m5 5l-6 6M21 20a1 1 0 01-1 1h-4m5-1v-4m-1 5l-6-6M4 20a1 1 0 01-1-1v-4m1 5h4m-5-5l6-6" />
              </svg>
              Iniciar escaneo
            </button>
            <button
              onClick={detenerEscaneo}
              disabled={!isScanning}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Detener escaneo
            </button>
          </div>

          {cameraError && (
            <div className="alert alert-error">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {cameraError}
              </div>
            </div>
          )}

          {/* Contenedor del lector: html5-qrcode inyecta el <video> aquí */}
          <div
            id={QR_REGION_ID}
            className={`w-full rounded-lg overflow-hidden bg-slate-100 ${isScanning ? 'min-h-[280px]' : 'min-h-0'}`}
          />

          {!isScanning && !cameraError && (
            <div className="text-center py-6 text-slate-400 text-sm">
              La cámara está apagada. Haz clic en "Iniciar escaneo" para activarla.
            </div>
          )}
        </div>

        {/* Sección marcado manual */}
        <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-base font-semibold text-slate-900">Marcado manual</h3>
          <p className="text-sm text-slate-500">
            Busca al cliente por nombre o apellido cuando no sea posible escanear el QR.
          </p>

          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setSelectedUsuario(null);
            }}
            placeholder="Buscar cliente por nombre o apellido..."
          />

          {loadingUsuarios && <p className="text-sm text-slate-400">Cargando clientes...</p>}

          {searchTerm.trim() && !selectedUsuario && (
            <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
              {filteredUsuarios.length === 0 ? (
                <div className="p-3 text-sm text-slate-400 text-center">
                  No se encontraron clientes activos con ese nombre
                </div>
              ) : (
                filteredUsuarios.map((usuario) => (
                  <div
                    key={usuario.id_usuario}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-indigo-50 transition-colors text-sm"
                  >
                    <button
                      onClick={() => handleSeleccionarUsuario(usuario)}
                      className="flex-1 text-left min-w-0"
                    >
                      <span className="font-medium text-slate-900">
                        {usuario.nombre} {usuario.apellido}
                      </span>
                      {usuario.telefono && (
                        <span className="text-slate-400 ml-2">{usuario.telefono}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUsuarioCalendario(usuario);
                      }}
                      title="Ver calendario de asistencias"
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {selectedUsuario && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {selectedUsuario.nombre} {selectedUsuario.apellido}
                </div>
                <div className="text-xs text-slate-500">Cliente seleccionado</div>
              </div>
              <button
                onClick={() => {
                  setSelectedUsuario(null);
                  setSearchTerm('');
                }}
                className="text-slate-400 hover:text-red-600 text-lg leading-none"
                title="Quitar selección"
              >
                ×
              </button>
            </div>
          )}

          <button
            onClick={handleMarcarManual}
            disabled={!selectedUsuario || marcando}
            className="btn-primary self-start flex items-center gap-2"
          >
            {marcando && <div className="loading-spinner w-4 h-4"></div>}
            Marcar asistencia
          </button>
        </div>
      </div>

      {/* Lista de asistencias recientes */}
      <div className="px-6 pb-6 flex-1 flex flex-col min-h-0">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Asistencias recientes</h3>

        {errorRecientes && (
          <div className="alert alert-error mb-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {errorRecientes}
            </div>
          </div>
        )}

        {loadingRecientes && recientes.length === 0 ? (
          <div className="py-8 text-center">
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-slate-500">Cargando asistencias...</p>
          </div>
        ) : (
          <div className="table-wrapper flex-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Registrado</th>
                </tr>
              </thead>
              <tbody>
                {recientes.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="text-center py-8">
                      <div className="text-slate-500">Aún no hay asistencias registradas</div>
                    </td>
                  </tr>
                ) : (
                  recientes.map((asistencia) => (
                    <tr
                      key={asistencia.id_asistencia}
                      onClick={() =>
                        setUsuarioCalendario({
                          id_usuario: asistencia.id_usuario,
                          nombre: asistencia.Usuario?.nombre || '',
                          apellido: asistencia.Usuario?.apellido || ''
                        })
                      }
                      className="cursor-pointer hover:bg-indigo-50 transition-colors"
                      title="Ver calendario de asistencias de este cliente"
                    >
                      <td>
                        {asistencia.Usuario
                          ? `${asistencia.Usuario.nombre} ${asistencia.Usuario.apellido}`
                          : `Usuario #${asistencia.id_usuario}`}
                      </td>
                      <td>{formatearTiempoRelativo(asistencia.fecha_hora)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalCalendarioAsistencias
        usuario={usuarioCalendario}
        onClose={() => setUsuarioCalendario(null)}
      />
    </div>
  );
}
