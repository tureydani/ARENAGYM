'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { SearchBar, Pagination } from '../ui';
import { IconEye, IconPencil, IconTrash, IconCheckCircle, IconDocumentDownload } from '../ui/Icons';
import { formatearFechaHoraBolivia, formatearSoloFechaBolivia, formatearSoloHoraBolivia, hoyBoliviaISO } from '../../utils/fechas';
import { getAdminActualId } from '../../utils/adminActual';
import ModalDetalleAsistencia from './ModalDetalleAsistencia';
import ModalEditarAsistencia from './ModalEditarAsistencia';
import ModalMotivoAccion from './ModalMotivoAccion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const PAGE_SIZE = 10;

function sumarDias(fechaISO, dias) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

function primerDiaMes(fechaISO, offsetMeses = 0) {
  const [a, m] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 + offsetMeses, 1));
  return fecha.toISOString().slice(0, 10);
}

function rangoPorPreset(preset) {
  const hoy = hoyBoliviaISO();
  switch (preset) {
    case 'hoy': return { fechaInicio: hoy, fechaFin: hoy };
    case 'ayer': { const ayer = sumarDias(hoy, -1); return { fechaInicio: ayer, fechaFin: ayer }; }
    case '7dias': return { fechaInicio: sumarDias(hoy, -6), fechaFin: hoy };
    case 'mes': return { fechaInicio: primerDiaMes(hoy, 0), fechaFin: hoy };
    case 'mesAnterior': return { fechaInicio: primerDiaMes(hoy, -1), fechaFin: sumarDias(primerDiaMes(hoy, 0), -1) };
    case 'todos': return { fechaInicio: '', fechaFin: '' };
    default: return { fechaInicio: hoy, fechaFin: hoy };
  }
}

// Tabla profesional de asistencias, reutilizada tanto por la pestaña "Hoy"
// (variant="hoy": fecha fija en el día actual, filtros reducidos) como por
// "Historial" (variant="historial": rango de fechas + todos los filtros).
// Toda la búsqueda, filtrado y paginación se resuelve en el backend (ver
// GET /api/asistencias) para no descargar todo el historial al navegador.
export default function AsistenciasLista({ variant = 'historial', titulo, subtitulo }) {
  const esHoy = variant === 'hoy';

  const [preset, setPreset] = useState(esHoy ? 'hoy' : 'todos');
  const [rango, setRango] = useState(esHoy ? rangoPorPreset('hoy') : { fechaInicio: '', fechaFin: '' });
  const [metodo, setMetodo] = useState('todos');
  const [estado, setEstado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [idAdmin, setIdAdmin] = useState('');
  const [administrativos, setAdministrativos] = useState([]);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [idDetalle, setIdDetalle] = useState(null);
  const [asistenciaEditar, setAsistenciaEditar] = useState(null);
  const [asistenciaAnular, setAsistenciaAnular] = useState(null);
  const [asistenciaReactivar, setAsistenciaReactivar] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);

  useEffect(() => {
    api.get('/administrativos?includeInactive=true').then((res) => {
      setAdministrativos(Array.isArray(res.data) ? res.data : []);
    }).catch(() => setAdministrativos([]));
  }, []);

  const cargar = useCallback(async (paginaSolicitada = page) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: paginaSolicitada,
        pageSize: PAGE_SIZE,
        estado: estado === 'todas' ? undefined : estado,
        metodo: metodo === 'todos' ? undefined : metodo,
        id_admin: idAdmin || undefined,
        busqueda: busqueda.trim() || undefined,
        fechaInicio: rango.fechaInicio || undefined,
        fechaFin: rango.fechaFin || undefined
      };
      const res = await api.get('/asistencias', { params });
      setRows(res.data.rows || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las asistencias.');
    } finally {
      setLoading(false);
    }
  }, [page, estado, metodo, idAdmin, busqueda, rango]);

  useEffect(() => { cargar(1); }, [estado, metodo, idAdmin, busqueda, rango]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const handlePreset = (valor) => {
    setPreset(valor);
    if (valor !== 'personalizado') setRango(rangoPorPreset(valor));
  };

  const refrescarTodo = () => {
    cargar(page);
    setIdDetalle(null);
  };

  const handleAnular = async (motivo) => {
    const id_admin = getAdminActualId();
    if (!id_admin) throw new Error('No se encontró el administrativo de la sesión actual');
    await api.patch(`/asistencias/${asistenciaAnular.id_asistencia}/anular`, { motivo, id_admin });
    setAsistenciaAnular(null);
    refrescarTodo();
  };

  const handleReactivar = async (motivo) => {
    const id_admin = getAdminActualId();
    if (!id_admin) throw new Error('No se encontró el administrativo de la sesión actual');
    await api.patch(`/asistencias/${asistenciaReactivar.id_asistencia}/reactivar`, { motivo, id_admin });
    setAsistenciaReactivar(null);
    refrescarTodo();
  };

  // Exporta TODO lo que coincide con los filtros actuales (no solo la
  // página visible): se pide una página grande al backend respetando los
  // mismos filtros, igual que hace el resto del panel (ver TablaPagos).
  const exportar = async (tipo) => {
    try {
      const params = {
        page: 1,
        pageSize: 2000,
        estado: estado === 'todas' ? undefined : estado,
        metodo: metodo === 'todos' ? undefined : metodo,
        id_admin: idAdmin || undefined,
        busqueda: busqueda.trim() || undefined,
        fechaInicio: rango.fechaInicio || undefined,
        fechaFin: rango.fechaFin || undefined
      };
      const res = await api.get('/asistencias', { params });
      const datos = res.data.rows || [];
      const fechaArchivo = new Date().toISOString().split('T')[0];

      if (tipo === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Reporte de Asistencias - Arena Gym', 14, 18);
        doc.setFontSize(10);
        doc.text(`Total: ${datos.length} registros`, 14, 26);
        autoTable(doc, {
          head: [['Cliente', 'Fecha', 'Hora', 'Método', 'Membresía', 'Estado', 'Registrado por']],
          body: datos.map((a) => [
            a.Usuario ? `${a.Usuario.nombre} ${a.Usuario.apellido}` : `Usuario #${a.id_usuario}`,
            formatearSoloFechaBolivia(a.fecha_hora),
            formatearSoloHoraBolivia(a.fecha_hora),
            a.metodo,
            a.RegistroMembresia?.Membresia?.tipo || 'N/A',
            a.activo ? 'Activa' : 'Anulada',
            a.Administrativo ? `${a.Administrativo.nombre} ${a.Administrativo.apellido}` : '-'
          ]),
          startY: 32,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [79, 70, 229] }
        });
        doc.save(`asistencias_${fechaArchivo}.pdf`);
      } else {
        const hoja = datos.map((a) => ({
          'ID': a.id_asistencia,
          'Cliente': a.Usuario ? `${a.Usuario.nombre} ${a.Usuario.apellido}` : `Usuario #${a.id_usuario}`,
          'Fecha y hora': formatearFechaHoraBolivia(a.fecha_hora),
          'Método': a.metodo,
          'Membresía': a.RegistroMembresia?.Membresia?.tipo || 'N/A',
          'Estado': a.activo ? 'Activa' : 'Anulada',
          'Registrado por': a.Administrativo ? `${a.Administrativo.nombre} ${a.Administrativo.apellido}` : '-',
          'Observación': a.observacion || ''
        }));
        const ws = XLSX.utils.json_to_sheet(hoja);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buffer]), `asistencias_${fechaArchivo}.xlsx`);
      }
    } catch (err) {
      console.error(err);
      alert('No se pudo generar el archivo de exportación');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
          {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => exportar('pdf')}>
            <IconDocumentDownload /> PDF
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => exportar('excel')}>
            <IconDocumentDownload /> Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px] flex-1">
          <SearchBar searchTerm={busqueda} onSearchChange={setBusqueda} placeholder="Buscar cliente por nombre, apellido o teléfono..." />
        </div>

        {!esHoy && (
          <select className="form-select modern" value={preset} onChange={(e) => handlePreset(e.target.value)}>
            <option value="todos">Todas las fechas</option>
            <option value="hoy">Hoy</option>
            <option value="ayer">Ayer</option>
            <option value="7dias">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="mesAnterior">Mes anterior</option>
            <option value="personalizado">Personalizado</option>
          </select>
        )}

        {!esHoy && preset === 'personalizado' && (
          <>
            <input type="date" className="form-input modern" value={rango.fechaInicio} onChange={(e) => setRango((r) => ({ ...r, fechaInicio: e.target.value }))} />
            <input type="date" className="form-input modern" value={rango.fechaFin} onChange={(e) => setRango((r) => ({ ...r, fechaFin: e.target.value }))} />
          </>
        )}

        <select className="form-select modern" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
          <option value="todos">Todos los métodos</option>
          <option value="QR">QR</option>
          <option value="Manual">Manual</option>
        </select>

        <select className="form-select modern" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="todas">Todos los estados</option>
          <option value="activas">Activas</option>
          <option value="anuladas">Anuladas</option>
        </select>

        <select className="form-select modern" value={idAdmin} onChange={(e) => setIdAdmin(e.target.value)}>
          <option value="">Todos los administrativos</option>
          {administrativos.map((a) => (
            <option key={a.id_admin} value={a.id_admin}>{a.nombre} {a.apellido}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Método</th>
              <th>Membresía</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8"><div className="loading-spinner mx-auto mb-2"></div>Consultando asistencias...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-slate-500">No hay asistencias para los filtros seleccionados.</td></tr>
            ) : (
              rows.map((a) => {
                const fechaTxt = formatearSoloFechaBolivia(a.fecha_hora);
                const horaTxt = formatearSoloHoraBolivia(a.fecha_hora);
                return (
                  <tr key={a.id_asistencia} className={!a.activo ? 'opacity-60' : ''}>
                    <td>{a.Usuario ? `${a.Usuario.nombre} ${a.Usuario.apellido}` : `Usuario #${a.id_usuario}`}</td>
                    <td>{fechaTxt}</td>
                    <td>{horaTxt}</td>
                    <td>{a.metodo}</td>
                    <td>{a.RegistroMembresia?.Membresia?.tipo || 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${a.activo ? 'status-active' : 'status-inactive'}`}>
                        {a.activo ? 'Válida' : 'Anulada'}
                      </span>
                    </td>
                    <td>
                      <div className="relative inline-block">
                        <button
                          className="action-buttons"
                          onClick={() => setMenuAbierto(menuAbierto === a.id_asistencia ? null : a.id_asistencia)}
                          title="Acciones"
                        >
                          ⋮
                        </button>
                        {menuAbierto === a.id_asistencia && (
                          <div
                            className="absolute right-0 z-10 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm"
                            onMouseLeave={() => setMenuAbierto(null)}
                          >
                            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={() => { setIdDetalle(a.id_asistencia); setMenuAbierto(null); }}>
                              <IconEye className="w-4 h-4" /> Ver detalle
                            </button>
                            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={() => { setAsistenciaEditar(a); setMenuAbierto(null); }}>
                              <IconPencil className="w-4 h-4" /> Editar
                            </button>
                            {a.activo ? (
                              <button className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={() => { setAsistenciaAnular(a); setMenuAbierto(null); }}>
                                <IconTrash className="w-4 h-4" /> Anular
                              </button>
                            ) : (
                              <button className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-600 flex items-center gap-2" onClick={() => { setAsistenciaReactivar(a); setMenuAbierto(null); }}>
                                <IconCheckCircle className="w-4 h-4" /> Reactivar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        startItem={startItem}
        endItem={endItem}
        itemsPerPage={PAGE_SIZE}
        onPageChange={(p) => cargar(p)}
        onNextPage={() => cargar(Math.min(totalPages, page + 1))}
        onPrevPage={() => cargar(Math.max(1, page - 1))}
        hasNextPage={page < totalPages}
        hasPrevPage={page > 1}
      />

      <ModalDetalleAsistencia
        idAsistencia={idDetalle}
        onCerrar={() => setIdDetalle(null)}
        onEditar={(a) => { setAsistenciaEditar(a); setIdDetalle(null); }}
        onAnular={(a) => { setAsistenciaAnular(a); setIdDetalle(null); }}
        onReactivar={(a) => { setAsistenciaReactivar(a); setIdDetalle(null); }}
      />

      <ModalEditarAsistencia
        abierto={!!asistenciaEditar}
        asistencia={asistenciaEditar}
        onCerrar={() => setAsistenciaEditar(null)}
        onGuardado={() => { setAsistenciaEditar(null); refrescarTodo(); }}
      />

      <ModalMotivoAccion
        abierto={!!asistenciaAnular}
        titulo="Anular asistencia"
        descripcion="La asistencia se conserva en el historial pero deja de contar para límites, estadísticas y reportes."
        cliente={asistenciaAnular?.Usuario ? `${asistenciaAnular.Usuario.nombre} ${asistenciaAnular.Usuario.apellido}` : ''}
        fechaHoraTexto={asistenciaAnular ? formatearFechaHoraBolivia(asistenciaAnular.fecha_hora) : ''}
        placeholder="Ej: Se registró asistencia duplicada"
        textoBoton="Anular asistencia"
        claseBoton="btn-delete enhanced-btn-sm"
        onConfirmar={handleAnular}
        onCerrar={() => setAsistenciaAnular(null)}
      />

      <ModalMotivoAccion
        abierto={!!asistenciaReactivar}
        titulo="Reactivar asistencia"
        descripcion="La asistencia volverá a contar para límites, estadísticas y reportes."
        cliente={asistenciaReactivar?.Usuario ? `${asistenciaReactivar.Usuario.nombre} ${asistenciaReactivar.Usuario.apellido}` : ''}
        fechaHoraTexto={asistenciaReactivar ? formatearFechaHoraBolivia(asistenciaReactivar.fecha_hora) : ''}
        placeholder="Ej: Se anuló por error"
        textoBoton="Reactivar asistencia"
        claseBoton="btn-primary"
        onConfirmar={handleReactivar}
        onCerrar={() => setAsistenciaReactivar(null)}
      />
    </div>
  );
}
