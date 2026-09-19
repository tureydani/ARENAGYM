'use client';
import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { hoyBoliviaISO, formatearSoloFechaBolivia } from '../../utils/fechas';
import { IconDocumentDownload } from '../ui/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function sumarDias(fechaISO, dias) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Pestaña "Reportes": indicadores calculados sobre un rango de fechas
// (nunca inventados, ver asistenciaService.reportes) más la herramienta
// de seguimiento "clientes con baja asistencia" (sección 24 del pedido).
export default function AsistenciasReportes() {
  const hoy = hoyBoliviaISO();
  const [fechaInicio, setFechaInicio] = useState(sumarDias(hoy, -29));
  const [fechaFin, setFechaFin] = useState(hoy);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [umbral, setUmbral] = useState(7);
  const [bajaFrecuencia, setBajaFrecuencia] = useState([]);
  const [cargandoBaja, setCargandoBaja] = useState(false);

  const cargarReporte = () => {
    setCargando(true);
    setError('');
    api.get('/asistencias/reportes', { params: { fechaInicio, fechaFin } })
      .then((res) => setReporte(res.data))
      .catch(() => setError('No se pudo generar el reporte.'))
      .finally(() => setCargando(false));
  };

  const cargarBajaFrecuencia = (u = umbral) => {
    setCargandoBaja(true);
    api.get('/asistencias/reportes/baja-frecuencia', { params: { umbral: u } })
      .then((res) => setBajaFrecuencia(Array.isArray(res.data) ? res.data : []))
      .catch(() => setBajaFrecuencia([]))
      .finally(() => setCargandoBaja(false));
  };

  useEffect(() => { cargarReporte(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargarBajaFrecuencia(umbral); }, [umbral]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportarReportePDF = () => {
    if (!reporte) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Reporte de Asistencias - Arena Gym', 14, 18);
    doc.setFontSize(10);
    doc.text(`Del ${reporte.rango.desde} al ${reporte.rango.hasta}`, 14, 26);
    doc.text(`Total: ${reporte.total} | Clientes únicos: ${reporte.clientesUnicos} | Promedio diario: ${reporte.promedioDiario}`, 14, 33);
    doc.text(`QR: ${reporte.qr} | Manual: ${reporte.manual}`, 14, 39);

    autoTable(doc, {
      head: [['Cliente más frecuente', 'Visitas']],
      body: reporte.masFrecuentes.map((c) => [`${c.nombre} ${c.apellido}`, c.cantidad]),
      startY: 46,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`reporte_asistencias_${reporte.rango.desde}_${reporte.rango.hasta}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="form-label modern">Desde</label>
          <input type="date" className="form-input modern" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="form-label modern">Hasta</label>
          <input type="date" className="form-input modern" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={cargarReporte}>Generar</button>
        {reporte && (
          <button className="btn-secondary flex items-center gap-2" onClick={exportarReportePDF}>
            <IconDocumentDownload /> Exportar PDF
          </button>
        )}
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}
      {cargando && <div className="py-6 text-center text-slate-500"><div className="loading-spinner mx-auto mb-2"></div>Generando reporte...</div>}

      {reporte && !cargando && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ['Total asistencias', reporte.total],
              ['Clientes que asistieron', reporte.clientesUnicos],
              ['Promedio diario', reporte.promedioDiario],
              ['Registros QR', reporte.qr],
              ['Registros manuales', reporte.manual]
            ].map(([label, valor]) => (
              <div key={label} className="border border-slate-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{valor}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Clientes con mayor frecuencia</h4>
              {reporte.masFrecuentes.length === 0 ? (
                <p className="text-sm text-slate-400">Sin datos en el rango.</p>
              ) : (
                <ul className="text-sm divide-y divide-slate-100">
                  {reporte.masFrecuentes.map((c) => (
                    <li key={c.id_usuario} className="py-1.5 flex justify-between">
                      <span>{c.nombre} {c.apellido}</span>
                      <span className="font-medium text-slate-700">{c.cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Días con más asistencias</h4>
              {reporte.diasConMasAsistencias.length === 0 ? (
                <p className="text-sm text-slate-400">Sin datos en el rango.</p>
              ) : (
                <ul className="text-sm divide-y divide-slate-100">
                  {reporte.diasConMasAsistencias.map((d) => (
                    <li key={d.fecha} className="py-1.5 flex justify-between">
                      <span>{formatearSoloFechaBolivia(`${d.fecha}T12:00:00`)}</span>
                      <span className="font-medium text-slate-700">{d.cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Horarios con más registros</h4>
              {reporte.horariosPico.length === 0 ? (
                <p className="text-sm text-slate-400">Sin datos en el rango.</p>
              ) : (
                <ul className="text-sm divide-y divide-slate-100">
                  {reporte.horariosPico.map((h) => (
                    <li key={h.hora} className="py-1.5 flex justify-between">
                      <span>{h.hora}</span>
                      <span className="font-medium text-slate-700">{h.cantidad}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      <div className="border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h4 className="text-sm font-semibold text-slate-900">Clientes con baja asistencia</h4>
          <select className="form-select modern" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))}>
            <option value={7}>Más de 7 días sin asistir</option>
            <option value={14}>Más de 14 días</option>
            <option value={30}>Más de 30 días</option>
          </select>
        </div>

        {cargandoBaja ? (
          <div className="py-6 text-center text-slate-500"><div className="loading-spinner mx-auto mb-2"></div>Consultando...</div>
        ) : bajaFrecuencia.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Ningún cliente activo supera ese umbral de inactividad.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Última asistencia</th>
                  <th>Días sin venir</th>
                  <th>Membresía</th>
                  <th>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {bajaFrecuencia.map((c) => (
                  <tr key={c.id_usuario}>
                    <td>{c.cliente}</td>
                    <td>{c.ultimaAsistencia ? formatearSoloFechaBolivia(c.ultimaAsistencia) : 'Nunca asistió'}</td>
                    <td>{c.diasDesdeUltimaAsistencia ?? '-'}</td>
                    <td>{c.membresia || 'N/A'}</td>
                    <td>{c.vencimiento || 'Sin vencimiento'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
