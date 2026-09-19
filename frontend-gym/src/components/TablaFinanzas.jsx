'use client';
import { useState, useEffect } from 'react';
import { Button, Card, Badge, SearchBar } from './ui';
import api from '../utils/api';
import { TIPOS_FONDO, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, tieneAccesoFinanzas } from '../constants/finanzasCatalogos';
import { formatearFecha } from '../utils/fechas';
import '../styles/tables.css';
import '../styles/modals.css';

export default function TablaFinanzas() {
  const adminData = typeof window !== 'undefined' ? sessionStorage.getItem('admin') : null;
  const admin = adminData ? JSON.parse(adminData) : null;
  const puedeEscribir = tieneAccesoFinanzas(admin?.rol, { escritura: true });
  const puedeLeer = tieneAccesoFinanzas(admin?.rol, { escritura: false });

  const [subTab, setSubTab] = useState('resumen');
  const [resumen, setResumen] = useState(null);
  const [fondos, setFondos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showFondoModal, setShowFondoModal] = useState(false);
  const [fondoForm, setFondoForm] = useState({ nombre: '', tipo_fondo: 'CAJA_FISICA', descripcion: '', saldo_inicial: '' });

  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState({ id_fondo: '', tipo: 'INGRESO', categoria: 'COBRO', monto: '', descripcion: '' });

  const [showTransfModal, setShowTransfModal] = useState(false);
  const [transfForm, setTransfForm] = useState({ id_fondo_origen: '', id_fondo_destino: '', monto: '', descripcion: '' });

  const [fondoDetalle, setFondoDetalle] = useState(null);
  const [searchMov, setSearchMov] = useState('');

  useEffect(() => { if (puedeLeer) cargarTodo(); else setLoading(false); }, []);

  const cargarTodo = async () => {
    setLoading(true);
    setError('');
    try {
      const [rResumen, rFondos, rMov] = await Promise.all([
        api.get('/finanzas/resumen'),
        api.get('/finanzas/fondos'),
        api.get('/finanzas/movimientos')
      ]);
      setResumen(rResumen.data);
      setFondos(rFondos.data);
      setMovimientos(rMov.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al cargar Finanzas');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (v) => (parseFloat(v) || 0).toFixed(2);

  const handleCrearFondo = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finanzas/fondos', {
        nombre: fondoForm.nombre.trim(),
        tipo_fondo: fondoForm.tipo_fondo,
        descripcion: fondoForm.descripcion || null,
        saldo_inicial: fondoForm.saldo_inicial ? parseFloat(fondoForm.saldo_inicial) : 0
      });
      setShowFondoModal(false);
      setFondoForm({ nombre: '', tipo_fondo: 'CAJA_FISICA', descripcion: '', saldo_inicial: '' });
      await cargarTodo();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al crear el fondo');
    }
  };

  const handleCrearMovimiento = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finanzas/movimientos', {
        id_fondo: parseInt(movForm.id_fondo),
        tipo: movForm.tipo,
        categoria: movForm.categoria,
        monto: parseFloat(movForm.monto),
        descripcion: movForm.descripcion || null
      });
      setShowMovModal(false);
      setMovForm({ id_fondo: '', tipo: 'INGRESO', categoria: 'COBRO', monto: '', descripcion: '' });
      await cargarTodo();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al registrar el movimiento');
    }
  };

  const handleTransferir = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/finanzas/transferencias', {
        id_fondo_origen: parseInt(transfForm.id_fondo_origen),
        id_fondo_destino: parseInt(transfForm.id_fondo_destino),
        monto: parseFloat(transfForm.monto),
        descripcion: transfForm.descripcion || null
      });
      alert(res.data.message);
      setShowTransfModal(false);
      setTransfForm({ id_fondo_origen: '', id_fondo_destino: '', monto: '', descripcion: '' });
      await cargarTodo();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al transferir');
    }
  };

  const handleAnular = async (mov) => {
    const motivo = prompt(`Motivo de anulación del movimiento #${mov.id_movimiento} (Bs. ${formatPrice(mov.monto)}):`);
    if (!motivo || !motivo.trim()) return;
    try {
      await api.post(`/finanzas/movimientos/${mov.id_movimiento}/anular`, { motivo: motivo.trim() });
      await cargarTodo();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al anular');
    }
  };

  const abrirDetalleFondo = async (fondo) => {
    try {
      const res = await api.get(`/finanzas/fondos/${fondo.id_fondo}`);
      setFondoDetalle(res.data);
    } catch (e) {
      alert(e.response?.data?.error || 'Error al cargar el detalle del fondo');
    }
  };

  const nombreFondo = (id) => fondos.find(f => f.id_fondo === id)?.nombre || `Fondo ${id}`;

  if (!puedeLeer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-slate-500">
          <p className="font-medium">No tenés permiso para ver Finanzas.</p>
          <p className="text-sm">Este módulo requiere rol Administrador o Recepcionista.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-slate-500">Cargando Finanzas...</p>
        </div>
      </div>
    );
  }

  const movimientosFiltrados = movimientos.filter(m =>
    !searchMov ||
    nombreFondo(m.id_fondo).toLowerCase().includes(searchMov.toLowerCase()) ||
    (m.descripcion || '').toLowerCase().includes(searchMov.toLowerCase()) ||
    (m.categoria || '').toLowerCase().includes(searchMov.toLowerCase())
  );

  return (
    <div className="table-container h-full flex flex-col relative">
      <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Finanzas</h2>
          <p className="text-slate-500">Control de fondos y movimientos de dinero de la empresa — distinto de Cajas (que controla cobros por jornada)</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

        <div className="flex gap-2 border-b border-slate-200">
          {[
            { id: 'resumen', label: 'Resumen' },
            { id: 'fondos', label: 'Fondos' },
            { id: 'movimientos', label: 'Movimientos' },
            { id: 'transferencias', label: 'Transferencias' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                subTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab === 'resumen' && resumen && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">Bs. {formatPrice(resumen.dinero_total_controlado)}</div>
                <div className="text-sm text-slate-500">Dinero total controlado</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">Bs. {formatPrice(resumen.ingresos_periodo)}</div>
                <div className="text-sm text-slate-500">Ingresos</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">Bs. {formatPrice(resumen.egresos_periodo)}</div>
                <div className="text-sm text-slate-500">Egresos</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-500">Bs. {formatPrice(resumen.transferencias_internas_periodo)}</div>
                <div className="text-sm text-slate-500">Transferencias internas</div>
                <div className="text-xs text-slate-400">No cuentan como ingreso/egreso</div>
              </Card>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Fondos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fondos.map(f => (
                  <Card key={f.id_fondo} className="p-4 cursor-pointer hover:border-indigo-300" onClick={() => abrirDetalleFondo(f)}>
                    <div className="text-sm text-slate-500">{TIPOS_FONDO.find(t => t.codigo === f.tipo_fondo)?.icono} {TIPOS_FONDO.find(t => t.codigo === f.tipo_fondo)?.nombre || f.tipo_fondo}</div>
                    <div className="font-semibold text-slate-900">{f.nombre}</div>
                    <div className="text-xl font-bold text-indigo-600 mt-1">Bs. {formatPrice(f.saldo_actual)}</div>
                  </Card>
                ))}
                {fondos.length === 0 && <p className="text-slate-500 text-sm">Todavía no hay fondos creados.</p>}
              </div>
            </div>
          </div>
        )}

        {subTab === 'fondos' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              {puedeEscribir && <Button onClick={() => setShowFondoModal(true)} size="sm">+ Nuevo fondo</Button>}
            </div>
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-indigo-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fondo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Saldo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {fondos.map(f => (
                    <tr key={f.id_fondo} className="hover:bg-indigo-50">
                      <td className="px-6 py-2 text-sm font-medium text-slate-900">{f.nombre}</td>
                      <td className="px-6 py-2 text-sm text-slate-600">{TIPOS_FONDO.find(t => t.codigo === f.tipo_fondo)?.nombre || f.tipo_fondo}</td>
                      <td className="px-6 py-2 text-sm font-semibold text-indigo-600">Bs. {formatPrice(f.saldo_actual)}</td>
                      <td className="px-6 py-2">
                        <Badge variant={f.activo ? 'success' : 'secondary'} className={f.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                          {f.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-2">
                        <button onClick={() => abrirDetalleFondo(f)} className="text-sm text-indigo-600 hover:underline">Ver movimientos</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fondos.length === 0 && <div className="text-center py-8 text-slate-500">No hay fondos todavía.</div>}
            </Card>
          </div>
        )}

        {subTab === 'movimientos' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center gap-4">
              <SearchBar value={searchMov} onChange={setSearchMov} placeholder="Buscar por fondo, categoría o descripción..." />
              {puedeEscribir && <Button onClick={() => setShowMovModal(true)} size="sm">+ Nuevo movimiento</Button>}
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-indigo-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fondo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Responsable</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                      {puedeEscribir && <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {movimientosFiltrados.map(m => (
                      <tr key={m.id_movimiento} className={`hover:bg-indigo-50 ${!m.activo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2 text-slate-600">{formatearFecha(m.fecha_movimiento, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-4 py-2 text-slate-900">{m.Fondo?.nombre || nombreFondo(m.id_fondo)}</td>
                        <td className="px-4 py-2">
                          <span className={`font-semibold px-2 py-1 rounded-md text-xs ${m.tipo === 'INGRESO' ? 'text-emerald-800 bg-emerald-100' : 'text-red-800 bg-red-100'}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{m.categoria}{m.origen === 'CIERRE_JORNADA' && m.Jornada ? ` (jornada: ${m.Jornada.descripcion})` : ''}</td>
                        <td className="px-4 py-2 font-medium">{m.tipo === 'INGRESO' ? '+' : '-'}Bs. {formatPrice(m.monto)}</td>
                        <td className="px-4 py-2 text-slate-600">{m.Administrativo ? `${m.Administrativo.nombre} ${m.Administrativo.apellido}` : 'N/A'}</td>
                        <td className="px-4 py-2">
                          {m.activo ? <span className="text-emerald-600 text-xs">Vigente</span> : <span className="text-slate-400 text-xs" title={m.motivo_anulacion}>Anulado</span>}
                        </td>
                        {puedeEscribir && (
                          <td className="px-4 py-2">
                            {m.activo && m.origen !== 'ANULACION' && m.categoria !== 'TRANSFERENCIA' && (
                              <button onClick={() => handleAnular(m)} className="text-xs text-red-600 hover:underline">Anular</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movimientosFiltrados.length === 0 && <div className="text-center py-8 text-slate-500">No hay movimientos.</div>}
              </div>
            </Card>
          </div>
        )}

        {subTab === 'transferencias' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-slate-500 text-sm">Mover dinero entre fondos no es un ingreso ni un egreso de la empresa: el total controlado no cambia.</p>
              {puedeEscribir && <Button onClick={() => setShowTransfModal(true)} size="sm">+ Nueva transferencia</Button>}
            </div>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-indigo-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Origen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Destino</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.values(
                    movimientos
                      .filter(m => m.categoria === 'TRANSFERENCIA')
                      .reduce((acc, m) => {
                        acc[m.id_transferencia] = acc[m.id_transferencia] || {};
                        acc[m.id_transferencia][m.tipo] = m;
                        return acc;
                      }, {})
                  ).map((par) => (
                    <tr key={par.EGRESO?.id_movimiento || par.INGRESO?.id_movimiento} className="hover:bg-indigo-50">
                      <td className="px-4 py-2 text-slate-600">{formatearFecha(par.EGRESO?.fecha_movimiento, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-2 text-slate-900">{par.EGRESO?.Fondo?.nombre || nombreFondo(par.EGRESO?.id_fondo)}</td>
                      <td className="px-4 py-2 text-slate-900">{par.INGRESO?.Fondo?.nombre || nombreFondo(par.INGRESO?.id_fondo)}</td>
                      <td className="px-4 py-2 font-medium">Bs. {formatPrice(par.EGRESO?.monto)}</td>
                      <td className="px-4 py-2 text-slate-600">{par.EGRESO?.Administrativo ? `${par.EGRESO.Administrativo.nombre} ${par.EGRESO.Administrativo.apellido}` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>

      {/* Modal Nuevo Fondo */}
      {showFondoModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Nuevo fondo</h3>
              <button className="modal-close" onClick={() => setShowFondoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCrearFondo} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input type="text" value={fondoForm.nombre} onChange={e => setFondoForm({ ...fondoForm, nombre: e.target.value })} className="form-input" placeholder="Ej. Caja física, Banco BCP..." required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select value={fondoForm.tipo_fondo} onChange={e => setFondoForm({ ...fondoForm, tipo_fondo: e.target.value })} className="form-input" required>
                    {TIPOS_FONDO.map(t => <option key={t.codigo} value={t.codigo}>{t.icono} {t.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción (opcional)</label>
                  <input type="text" value={fondoForm.descripcion} onChange={e => setFondoForm({ ...fondoForm, descripcion: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Saldo inicial (Bs., opcional)</label>
                  <input type="number" step="0.01" min="0" value={fondoForm.saldo_inicial} onChange={e => setFondoForm({ ...fondoForm, saldo_inicial: e.target.value })} className="form-input" placeholder="0.00" />
                  <p className="text-xs text-slate-500 mt-1">Se registra como movimiento "Saldo inicial", no como un ingreso operativo.</p>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary">Crear fondo</button>
                  <button type="button" onClick={() => setShowFondoModal(false)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {showMovModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Nuevo movimiento</h3>
              <button className="modal-close" onClick={() => setShowMovModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCrearMovimiento} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Fondo</label>
                  <select value={movForm.id_fondo} onChange={e => setMovForm({ ...movForm, id_fondo: e.target.value })} className="form-input" required>
                    <option value="">Selecciona un fondo</option>
                    {fondos.map(f => <option key={f.id_fondo} value={f.id_fondo}>{f.nombre} — Bs. {formatPrice(f.saldo_actual)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    value={movForm.tipo}
                    onChange={e => setMovForm({ ...movForm, tipo: e.target.value, categoria: e.target.value === 'INGRESO' ? 'COBRO' : 'GASTO_OPERATIVO' })}
                    className="form-input"
                  >
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select value={movForm.categoria} onChange={e => setMovForm({ ...movForm, categoria: e.target.value })} className="form-input" required>
                    {(movForm.tipo === 'INGRESO' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => (
                      <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto (Bs.)</label>
                  <input type="number" step="0.01" min="0.01" value={movForm.monto} onChange={e => setMovForm({ ...movForm, monto: e.target.value })} className="form-input" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción (opcional)</label>
                  <textarea value={movForm.descripcion} onChange={e => setMovForm({ ...movForm, descripcion: e.target.value })} className="form-input" rows="2" />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary">Registrar</button>
                  <button type="button" onClick={() => setShowMovModal(false)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transferencia */}
      {showTransfModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Transferir entre fondos</h3>
              <button className="modal-close" onClick={() => setShowTransfModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleTransferir} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Origen</label>
                  <select value={transfForm.id_fondo_origen} onChange={e => setTransfForm({ ...transfForm, id_fondo_origen: e.target.value })} className="form-input" required>
                    <option value="">Selecciona el fondo de origen</option>
                    {fondos.map(f => <option key={f.id_fondo} value={f.id_fondo}>{f.nombre} — Bs. {formatPrice(f.saldo_actual)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Destino</label>
                  <select value={transfForm.id_fondo_destino} onChange={e => setTransfForm({ ...transfForm, id_fondo_destino: e.target.value })} className="form-input" required>
                    <option value="">Selecciona el fondo de destino</option>
                    {fondos.filter(f => String(f.id_fondo) !== String(transfForm.id_fondo_origen)).map(f => (
                      <option key={f.id_fondo} value={f.id_fondo}>{f.nombre} — Bs. {formatPrice(f.saldo_actual)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto (Bs.)</label>
                  <input type="number" step="0.01" min="0.01" value={transfForm.monto} onChange={e => setTransfForm({ ...transfForm, monto: e.target.value })} className="form-input" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción (opcional)</label>
                  <input type="text" value={transfForm.descripcion} onChange={e => setTransfForm({ ...transfForm, descripcion: e.target.value })} className="form-input" />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary">Transferir</button>
                  <button type="button" onClick={() => setShowTransfModal(false)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Fondo */}
      {fondoDetalle && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>{fondoDetalle.nombre}</h3>
              <button onClick={() => setFondoDetalle(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="text-sm text-slate-500">{TIPOS_FONDO.find(t => t.codigo === fondoDetalle.tipo_fondo)?.nombre}</div>
                  <div className="text-2xl font-bold text-indigo-600">Bs. {formatPrice(fondoDetalle.saldo_actual)}</div>
                </div>
                <Badge variant={fondoDetalle.activo ? 'success' : 'secondary'} className={fondoDetalle.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {fondoDetalle.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="px-3 py-2 text-left border-b border-slate-300">Fecha</th>
                    <th className="px-3 py-2 text-left border-b border-slate-300">Tipo</th>
                    <th className="px-3 py-2 text-left border-b border-slate-300">Categoría</th>
                    <th className="px-3 py-2 text-left border-b border-slate-300">Monto</th>
                    <th className="px-3 py-2 text-left border-b border-slate-300">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {fondoDetalle.movimientos.map(m => (
                    <tr key={m.id_movimiento} className={!m.activo ? 'opacity-50' : ''}>
                      <td className="px-3 py-2">{formatearFecha(m.fecha_movimiento, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2">{m.tipo}</td>
                      <td className="px-3 py-2">{m.categoria}</td>
                      <td className="px-3 py-2 font-medium">{m.tipo === 'INGRESO' ? '+' : '-'}Bs. {formatPrice(m.monto)}</td>
                      <td className="px-3 py-2">{m.activo ? 'Vigente' : 'Anulado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fondoDetalle.movimientos.length === 0 && <p className="text-center text-slate-500 py-6">Sin movimientos todavía.</p>}
              <div className="modal-actions mt-4">
                <button onClick={() => setFondoDetalle(null)} className="btn-secondary">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
