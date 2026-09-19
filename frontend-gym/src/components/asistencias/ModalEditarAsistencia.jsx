'use client';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getAdminActualId } from '../../utils/adminActual';

// Edición de una asistencia: solo fecha/hora, cliente y observación (nunca
// el id_asistencia ni relaciones inválidas -- ver sección 20 del pedido).
// El motivo es obligatorio y el backend vuelve a validar todo (membresía
// vigente del nuevo cliente si se cambia) sin confiar en el frontend.
export default function ModalEditarAsistencia({ abierto, asistencia, onGuardado, onCerrar }) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [observacion, setObservacion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto || !asistencia) return;
    const fechaHora = new Date(asistencia.fecha_hora);
    const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(fechaHora);
    const horaLocal = fechaHora.toLocaleTimeString('en-GB', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' });
    setFecha(fechaLocal);
    setHora(horaLocal);
    setObservacion(asistencia.observacion || '');
    setMotivo('');
    setError('');
    setClienteBusqueda(asistencia.Usuario ? `${asistencia.Usuario.nombre} ${asistencia.Usuario.apellido}` : '');
    setClienteSeleccionado(null);

    api.get('/usuarios').then((res) => {
      setUsuarios(Array.isArray(res.data) ? res.data.filter((u) => u.activo !== false) : []);
    }).catch(() => setUsuarios([]));
  }, [abierto, asistencia]);

  if (!abierto || !asistencia) return null;

  const coincidencias = clienteBusqueda.trim() && !clienteSeleccionado
    ? usuarios.filter((u) => `${u.nombre} ${u.apellido}`.toLowerCase().includes(clienteBusqueda.toLowerCase().trim())).slice(0, 6)
    : [];

  const handleGuardar = async () => {
    if (!motivo.trim()) {
      setError('El motivo de la modificación es obligatorio');
      return;
    }
    const id_admin = getAdminActualId();
    if (!id_admin) {
      setError('No se encontró el administrativo de la sesión actual');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      const body = {
        fecha_hora: `${fecha}T${hora}:00`,
        observacion,
        motivo: motivo.trim(),
        id_admin
      };
      if (clienteSeleccionado) body.id_usuario = clienteSeleccionado.id_usuario;

      const res = await api.patch(`/asistencias/${asistencia.id_asistencia}`, body);
      onGuardado(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la modificación');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-container" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Editar asistencia #{asistencia.id_asistencia}</h3>
          <button className="modal-close" onClick={onCerrar}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div>
              <label className="form-label modern">Fecha</label>
              <input type="date" className="form-input modern" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="form-label modern">Hora</label>
              <input type="time" className="form-input modern" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <div className="form-group mt-3">
            <label className="form-label modern">Cliente</label>
            <input
              type="text"
              className="form-input modern"
              value={clienteBusqueda}
              onChange={(e) => { setClienteBusqueda(e.target.value); setClienteSeleccionado(null); }}
              placeholder="Buscar cliente por nombre..."
            />
            {coincidencias.length > 0 && (
              <div className="border border-slate-200 rounded-lg mt-1 max-h-40 overflow-y-auto divide-y divide-slate-100">
                {coincidencias.map((u) => (
                  <button
                    type="button"
                    key={u.id_usuario}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                    onClick={() => { setClienteSeleccionado(u); setClienteBusqueda(`${u.nombre} ${u.apellido}`); }}
                  >
                    {u.nombre} {u.apellido}
                  </button>
                ))}
              </div>
            )}
            {clienteSeleccionado && (
              <div className="text-xs text-indigo-600 mt-1">
                Se reasignará esta asistencia a {clienteSeleccionado.nombre} {clienteSeleccionado.apellido} (se recalculará su membresía)
              </div>
            )}
          </div>

          <div className="form-group mt-3">
            <label className="form-label modern">Observación</label>
            <textarea
              className="form-input modern"
              rows={2}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="form-group mt-3">
            <label className="form-label modern">Motivo de la modificación (obligatorio)</label>
            <textarea
              className="form-input modern"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Corrección de hora de ingreso"
            />
          </div>

          {error && <div className="alert alert-error mt-3"><span>{error}</span></div>}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button className="btn-primary" onClick={handleGuardar} disabled={guardando || !motivo.trim()}>
            {guardando && <div className="loading-spinner w-4 h-4"></div>}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
