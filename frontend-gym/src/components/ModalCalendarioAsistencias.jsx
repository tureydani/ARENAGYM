'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import CalendarioAsistencias from './CalendarioAsistencias';
import '../styles/modals.css';

const mesActualISO = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
};

const formatearFechaLegible = (fechaIso) => {
  if (!fechaIso) return 'Sin visitas registradas';
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return 'Sin visitas registradas';
  return fecha.toLocaleString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Modal que muestra el calendario mensual de asistencias de un cliente
 * puntual, junto a su total histórico y última visita.
 *
 * Props:
 * - usuario: { id_usuario, nombre, apellido } | null (null => modal cerrado)
 * - onClose: () => void
 */
export default function ModalCalendarioAsistencias({ usuario, onClose }) {
  const [mes, setMes] = useState(mesActualISO());
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async (idUsuario, mesConsulta) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/asistencias/usuario/${idUsuario}`, {
        params: { mes: mesConsulta }
      });
      setDatos(res.data);
    } catch (err) {
      console.error('Error al cargar asistencias del cliente:', err);
      setError(
        err.response?.data?.error || 'No se pudo cargar el historial de asistencias de este cliente'
      );
      setDatos(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    const mesInicial = mesActualISO();
    setMes(mesInicial);
    cargarDatos(usuario.id_usuario, mesInicial);
    // Se ejecuta solo al abrir (cambio de usuario), la navegación de mes se maneja aparte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const handleCambiarMes = (nuevoMes) => {
    setMes(nuevoMes);
    if (usuario) {
      cargarDatos(usuario.id_usuario, nuevoMes);
    }
  };

  if (!usuario) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '420px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            {usuario.nombre} {usuario.apellido}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide">
                Total histórico de asistencias
              </div>
              <div className="text-3xl font-bold text-indigo-700 mt-1">
                {datos ? datos.totalHistorico : '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Este mes
              </div>
              <div className="text-xl font-semibold text-slate-700 mt-1">
                {datos ? datos.totalDelMes : '—'}
              </div>
            </div>
          </div>

          <CalendarioAsistencias
            mes={mes}
            diasMarcados={datos?.diasDelMes || []}
            onCambiarMes={handleCambiarMes}
            loading={loading}
          />

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-400">Última visita</span>
            <span className="font-medium text-slate-700">
              {datos ? formatearFechaLegible(datos.ultimaVisita) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
