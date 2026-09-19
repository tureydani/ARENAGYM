'use client';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { formatearFechaHoraBolivia } from '../../utils/fechas';

const ETIQUETA_ACCION = {
  CREACION: 'Creación',
  EDICION: 'Edición',
  ANULACION: 'Anulación',
  REACTIVACION: 'Reactivación'
};

// Vista de detalle completo de una asistencia: cliente, membresía usada y
// su vigencia, quién la registró, uso actual de la membresía, y el
// historial completo de auditoría (sección 19 y 22 del pedido). Los
// botones de acción llaman a los callbacks del padre, que abren a su vez
// los modales de editar/anular/reactivar.
export default function ModalDetalleAsistencia({ idAsistencia, onCerrar, onEditar, onAnular, onReactivar }) {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => {
    if (!idAsistencia) return;
    setCargando(true);
    setError('');
    api.get(`/asistencias/${idAsistencia}`)
      .then((res) => setDetalle(res.data))
      .catch(() => setError('No se pudo cargar el detalle de la asistencia'))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, [idAsistencia]);

  if (!idAsistencia) return null;

  const asistencia = detalle?.asistencia;
  const registro = asistencia?.RegistroMembresia;
  const membresia = registro?.Membresia;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-container" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Asistencia #{idAsistencia}</h3>
          <button className="modal-close" onClick={onCerrar}>&times;</button>
        </div>
        <div className="modal-body">
          {cargando && <p className="text-slate-500 text-sm">Cargando...</p>}
          {error && <div className="alert alert-error"><span>{error}</span></div>}

          {asistencia && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <div className="text-slate-400 text-xs uppercase">Cliente</div>
                  <div className="font-medium text-slate-900">
                    {asistencia.Usuario ? `${asistencia.Usuario.nombre} ${asistencia.Usuario.apellido}` : `Usuario #${asistencia.id_usuario}`}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Estado</div>
                  <span className={`status-badge ${asistencia.activo ? 'status-active' : 'status-inactive'}`}>
                    {asistencia.activo ? 'Activa' : 'Anulada'}
                  </span>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Membresía</div>
                  <div className="text-slate-900">{membresia?.tipo || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Vigencia</div>
                  <div className="text-slate-900">
                    {registro?.fecha_inicio || 'N/A'} - {registro?.fecha_fin || 'Sin vencimiento'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Fecha y hora</div>
                  <div className="text-slate-900">{formatearFechaHoraBolivia(asistencia.fecha_hora)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Método</div>
                  <div className="text-slate-900">{asistencia.metodo}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Registrado por</div>
                  <div className="text-slate-900">
                    {asistencia.Administrativo ? `${asistencia.Administrativo.nombre} ${asistencia.Administrativo.apellido}` : 'No registrado'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase">Asistencias usadas</div>
                  <div className="text-slate-900">
                    {detalle.asistenciasUsadas} / {membresia?.limite_asistencias ?? 'ilimitadas'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-400 text-xs uppercase">Observación</div>
                  <div className="text-slate-900">{asistencia.observacion || '-'}</div>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button className="btn-secondary" onClick={() => onEditar(asistencia)}>Editar</button>
                {asistencia.activo ? (
                  <button className="btn-delete enhanced-btn-sm" onClick={() => onAnular(asistencia)}>Anular asistencia</button>
                ) : (
                  <button className="btn-primary" onClick={() => onReactivar(asistencia)}>Reactivar asistencia</button>
                )}
              </div>

              <h4 className="text-sm font-semibold text-slate-900 mb-2">Historial de cambios</h4>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {detalle.auditorias.length === 0 ? (
                  <div className="p-3 text-sm text-slate-400">Sin registros de auditoría</div>
                ) : (
                  detalle.auditorias.map((a) => (
                    <div key={a.id_auditoria} className="p-3 text-sm">
                      <div className="flex justify-between items-baseline">
                        <span className="font-semibold text-slate-900">{ETIQUETA_ACCION[a.accion] || a.accion}</span>
                        <span className="text-xs text-slate-400">{formatearFechaHoraBolivia(a.fecha_accion)}</span>
                      </div>
                      <div className="text-slate-500 text-xs">
                        {a.Administrativo ? `${a.Administrativo.nombre} ${a.Administrativo.apellido}` : 'Sistema'}
                      </div>
                      {a.motivo && <div className="text-slate-700 mt-1">Motivo: {a.motivo}</div>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
