import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import Button from './ui/Button';
import SearchBar from './ui/SearchBar';
import Pagination from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import TablaVentas from './TablaVentas';
import { IconDocumentDownload, IconPencil, IconTrash, IconMagnifyingGlass, IconIdentification, IconEye, IconBanknotes, IconArchiveBox, IconCalendar, IconChartBar, IconCheckCircle, IconSave } from './ui/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { formatearFecha, parsearFechaLocal } from '../utils/fechas';
import '../styles/tables.css';
import '../styles/modals.css';

const TablaPagos = () => {
  const [activeTab, setActiveTab] = useState('pagos');
  const [pagos, setPagos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [administrativos, setAdministrativos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Filas expandidas ("Ver más") para mostrar ID, precio base, caja y fecha
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleExpandRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const [editingPago, setEditingPago] = useState(null);
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);
  
  // Estados para exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [tipoExportacion, setTipoExportacion] = useState('pdf');
  const [filtroFecha, setFiltroFecha] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Función para obtener fecha local en formato YYYY-MM-DD
  const getFechaHoyLocal = () => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };
  
  const [formData, setFormData] = useState({
    id_registro: '',
    id_admin: '1', // Administrativo por defecto (asumiendo ID 1)
    id_caja: '1', // Caja principal por defecto
    monto_pagado: '',
    fecha_pago: '', // Se establecerá con fecha local
    estado_pago: 'Completo'
  });

  // Función para obtener información del registro (movida antes del filtro)
  const getRegistroInfo = (idRegistro) => {
    if (!idRegistro || !registros.length) {
      return { 
        usuario: 'N/A', 
        membresia: 'N/A',
        precio: 0,
        duracion: 'N/A'
      };
    }

    const registro = registros.find(r => r.id_registro === idRegistro);
    if (!registro) {
      return { 
        usuario: 'Usuario no encontrado', 
        membresia: 'Membresía no encontrada',
        precio: 0,
        duracion: 'N/A'
      };
    }

    const usuario = usuarios.find(u => u.id_usuario === registro.id_usuario);
    const membresia = membresias.find(m => m.id_membresia === registro.id_membresia);

    return {
      usuario: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario no encontrado',
      membresia: membresia ? membresia.tipo : 'Membresía no encontrada',
      precio: membresia ? membresia.precio : 0,
      duracion: membresia ? `${membresia.duracion_dias} días` : 'N/A'
    };
  };

  // Funciones de exportación
  const filtrarPagosPorFecha = () => {
    let pagosFiltrados = [...pagos];

    switch (filtroFecha) {
      case 'semana':
        const semanaAtras = new Date();
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        pagosFiltrados = pagos.filter(pago => {
          const fechaPago = parsearFechaLocal(pago.fecha_pago);
          return fechaPago >= semanaAtras;
        });
        break;
      case 'mes':
        const mesAtras = new Date();
        mesAtras.setMonth(mesAtras.getMonth() - 1);
        pagosFiltrados = pagos.filter(pago => {
          const fechaPago = parsearFechaLocal(pago.fecha_pago);
          return fechaPago >= mesAtras;
        });
        break;
      case 'personalizado':
        if (fechaInicio && fechaFin) {
          pagosFiltrados = pagos.filter(pago => {
            const fechaPago = parsearFechaLocal(pago.fecha_pago);
            return fechaPago >= parsearFechaLocal(fechaInicio) && fechaPago <= parsearFechaLocal(fechaFin);
          });
        }
        break;
      default:
        break;
    }

    return pagosFiltrados;
  };

  const exportarPDF = () => {
    const pagosFiltrados = filtrarPagosPorFecha();
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Reporte de Pagos - Gimnasio', 20, 20);

    doc.setFontSize(12);
    let textoFiltro = '';
    switch (filtroFecha) {
      case 'semana':
        textoFiltro = 'Filtro: Última semana';
        break;
      case 'mes':
        textoFiltro = 'Filtro: Último mes';
        break;
      case 'personalizado':
        textoFiltro = `Filtro: ${fechaInicio} a ${fechaFin}`;
        break;
      default:
        textoFiltro = 'Filtro: Todos los tiempos';
    }
    doc.text(textoFiltro, 20, 35);
    doc.text(`Total de pagos: ${pagosFiltrados.length}`, 20, 45);
    doc.text(`Total recaudado: Bs. ${pagosFiltrados.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0).toFixed(2)}`, 20, 55);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 20, 65);

    const tableData = pagosFiltrados.map(pago => {
      const registroInfo = getRegistroInfo(pago.id_registro);
      const admin = administrativos.find(a => a.id_admin === pago.id_admin);
      
      return [
        pago.id_pago,
        registroInfo.usuario,
        registroInfo.membresia,
        formatearFecha(pago.fecha_pago),
        `Bs. ${pago.monto_pagado}`,
        pago.estado_pago,
        admin ? `${admin.nombre} ${admin.apellido}` : `Admin ID: ${pago.id_admin}`
      ];
    });

    autoTable(doc, {
      head: [['ID', 'Cliente', 'Membresía', 'Fecha', 'Monto', 'Estado', 'Registrado Por']],
      body: tableData,
      startY: 75,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const fechaArchivo = new Date().toISOString().split('T')[0];
    doc.save(`pagos_${filtroFecha}_${fechaArchivo}.pdf`);

    setShowExportModal(false);
  };

  const exportarExcel = () => {
    const pagosFiltrados = filtrarPagosPorFecha();
    
    const datosExcel = pagosFiltrados.map(pago => {
      const registroInfo = getRegistroInfo(pago.id_registro);
      const admin = administrativos.find(a => a.id_admin === pago.id_admin);
      const caja = cajas.find(c => c.id_caja === pago.id_caja);
      
      return {
        'ID Pago': pago.id_pago,
        'ID Registro': pago.id_registro,
        'Cliente': registroInfo.usuario,
        'Membresía': registroInfo.membresia,
        'Duración': registroInfo.duracion,
        'Precio Membresía': `Bs. ${registroInfo.precio}`,
        'Monto Pagado': `Bs. ${pago.monto_pagado}`,
        'Fecha Pago': formatearFecha(pago.fecha_pago),
        'Estado': pago.estado_pago,
        'Registrado Por': admin ? `${admin.nombre} ${admin.apellido}` : `Admin ID: ${pago.id_admin}`,
        'Caja': caja ? caja.descripcion : `Caja ID: ${pago.id_caja}`,
        'ID Admin': pago.id_admin,
        'ID Caja': pago.id_caja
      };
    });

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos');

    const totalRecaudado = pagosFiltrados.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0);
    const resumenData = [
      ['REPORTE DE PAGOS - GIMNASIO'],
      [''],
      ['Filtro aplicado:', filtroFecha === 'personalizado' ? `${fechaInicio} a ${fechaFin}` : filtroFecha],
      ['Total de pagos:', pagosFiltrados.length],
      ['Pagos completos:', pagosFiltrados.filter(p => p.estado_pago === 'Completo').length],
      ['Pagos parciales:', pagosFiltrados.filter(p => p.estado_pago === 'Parcial').length],
      ['Pagos pendientes:', pagosFiltrados.filter(p => p.estado_pago === 'Pendiente').length],
      ['Total recaudado:', `Bs. ${totalRecaudado.toFixed(2)}`],
      ['Promedio por pago:', `Bs. ${(totalRecaudado / pagosFiltrados.length || 0).toFixed(2)}`],
      ['Fecha de generación:', new Date().toLocaleDateString()],
      ['Hora de generación:', new Date().toLocaleTimeString()]
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen');

    const fechaArchivo = new Date().toISOString().split('T')[0];
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `pagos_${filtroFecha}_${fechaArchivo}.xlsx`);

    setShowExportModal(false);
  };

  const handleExportar = () => {
    if (tipoExportacion === 'pdf') {
      exportarPDF();
    } else {
      exportarExcel();
    }
  };

  // Filtrar pagos - simplificado similar a TablaVentas
  const filteredPagos = pagos.filter(pago => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Búsqueda en datos básicos del pago
    const idMatch = pago.id_pago.toString().includes(searchLower);
    const montoMatch = pago.monto_pagado.toString().includes(searchLower);
    const estadoMatch = pago.estado_pago.toLowerCase().includes(searchLower);
    
    // Búsqueda en información del registro relacionado
    const registroInfo = getRegistroInfo(pago.id_registro);
    const usuarioMatch = registroInfo.usuario.toLowerCase().includes(searchLower);
    const membresiaMatch = registroInfo.membresia.toLowerCase().includes(searchLower);
    const precioMatch = registroInfo.precio.toString().includes(searchLower);
    
    return (
      idMatch ||
      montoMatch ||
      estadoMatch ||
      usuarioMatch ||
      membresiaMatch ||
      precioMatch
    );
  });

  // Paginación
  const {
    currentPage,
    totalPages,
    totalItems,
    startItem,
    endItem,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage
  } = usePagination(filteredPagos, 8);

  const paginatedData = filteredPagos.slice(startItem - 1, endItem);

  // Cargar datos iniciales
  useEffect(() => {
    loadPagos();
    loadSelectData();
  }, []);

  const loadPagos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/pagos');
      setPagos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
      setError('Error al cargar los pagos');
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectData = async () => {
    try {
      const [registrosRes, usuariosRes, membresiasRes, adminsRes, cajasRes] = await Promise.all([
        api.get('/registro-membresias?includeInactive=true'),
        api.get('/usuarios?includeInactive=true'),
        api.get('/membresias?includeInactive=true'),
        api.get('/administrativos?includeInactive=true'),
        api.get('/cajas')
      ]);

      setRegistros(Array.isArray(registrosRes.data) ? registrosRes.data : []);
      setUsuarios(Array.isArray(usuariosRes.data) ? usuariosRes.data : []);
      setMembresias(Array.isArray(membresiasRes.data) ? membresiasRes.data : []);
      setAdministrativos(Array.isArray(adminsRes.data) ? adminsRes.data : []);
      setCajas(Array.isArray(cajasRes.data) ? cajasRes.data : []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      // Asegurar que los arrays estén inicializados aunque falle la carga
      setRegistros([]);
      setUsuarios([]);
      setMembresias([]);
      setAdministrativos([]);
      setCajas([]);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    goToPage(1);
  };

  const openCreateModal = () => {
    setEditingPago(null);
    const fechaHoy = getFechaHoyLocal();
    const adminData = sessionStorage.getItem('admin');
    const admin = adminData ? JSON.parse(adminData) : null;
    setFormData({
      id_registro: '',
      id_admin: admin?.id_admin || '1',
      id_caja: '1', // Caja principal por defecto
      monto_pagado: '',
      fecha_pago: fechaHoy, // Fecha local segura
      estado_pago: 'Completo'
    });
    setShowModal(true);
  };

  const openEditModal = (pago) => {
    setEditingPago(pago);
    setFormData({
      id_registro: pago.id_registro,
      id_admin: pago.id_admin,
      id_caja: pago.id_caja,
      monto_pagado: pago.monto_pagado,
      fecha_pago: pago.fecha_pago ? pago.fecha_pago.split('T')[0] : getFechaHoyLocal(),
      estado_pago: pago.estado_pago
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPago(null);
    setFormData({
      id_registro: '',
      id_admin: '1',
      id_caja: '1',
      monto_pagado: '',
      fecha_pago: getFechaHoyLocal(),
      estado_pago: 'Completo'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let pagoResponse;
      if (editingPago) {
        pagoResponse = await api.put(`/pagos/${editingPago.id_pago}`, formData);
      } else {
        // Solo crear el pago - el trigger automáticamente maneja el movimiento de caja
        pagoResponse = await api.post('/pagos', formData);
      }

      // *** NOTA: El trigger de la base de datos automáticamente:
      // 1. Actualiza el saldo de la caja
      // 2. Crea el movimiento en movimientos_caja
      // NO necesitamos crear movimientos manualmente aquí ***

      await loadPagos();
      closeModal();
      
      // Mostrar check de éxito
      setShowSuccessCheck(true);
      setTimeout(() => setShowSuccessCheck(false), 3000);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar el pago');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de que desea eliminar este pago?\n\nEsto restará el monto del pago de la caja correspondiente.')) return;

    try {
      const response = await api.delete(`/pagos/${id}`);
      const resultado = response.data;

      await loadPagos();
      
      // Mostrar notificación detallada con información de la caja
      if (resultado.cajaAfectada) {
        alert(
          `Pago eliminado exitosamente\n\n` +
          `Monto: Bs. ${resultado.montoPago}\n` +
          `Cliente: ${resultado.cliente}\n\n` +
          `Caja afectada: ${resultado.cajaAfectada.descripcion}\n` +
          `Saldo anterior: Bs. ${resultado.cajaAfectada.saldoAnterior}\n` +
          `Saldo actual: Bs. ${resultado.cajaAfectada.saldoActual}\n` +
          `Diferencia: Bs. ${resultado.cajaAfectada.diferencia}`
        );
      } else {
        alert('Pago eliminado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error.response?.data?.error || 'Error al eliminar el pago';
      alert(`Error: ${errorMsg}`);
    }
  };

  if (activeTab === 'ventas') {
    return <TablaVentas />;
  }

  if (loading) return <div className="text-center py-8 text-slate-900">Cargando pagos...</div>;
  if (error) return <div className="text-center py-8 text-red-400">{error}</div>;

  return (
    <div className="pagos-container">
      {/* Tabs - Fijo en la parte superior */}
      <div className="tab-container">
        <button 
          className={`tab ${activeTab === 'pagos' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('pagos')}
        >
          Pagos
        </button>
        <button 
          className={`tab ${activeTab === 'ventas' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('ventas')}
        >
          Ventas
        </button>
      </div>

      {/* Success Check Notification */}
      {showSuccessCheck && (
        <div className="success-notification">
          <div className="success-check">
            <div className="check-icon">✓</div>
            <span>¡Pago registrado exitosamente!</span>
          </div>
        </div>
      )}

      {/* Contenido scrolleable */}
      <div className="pagos-content-wrapper">
        <div className="pagos-content">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Gestión de Pagos</h2>
            <div className="flex gap-3">
              <Button 
                onClick={() => setShowExportModal(true)} 
                className="btn-info enhanced-btn"
              >
                <span className="btn-icon"><IconDocumentDownload /></span>
                Exportar
              </Button>
              <Button onClick={openCreateModal} className="btn-primary enhanced-btn">
                <span className="btn-icon">+</span>
                Nuevo Pago
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              placeholder="Buscar por ID, cliente, membresía, monto, estado..."
            />
            {searchTerm && (
              <div className="mt-2 text-sm text-slate-500">
                {filteredPagos.length === 0 
                  ? `No se encontraron pagos para "${searchTerm}"` 
                  : `${filteredPagos.length} pago(s) encontrado(s)`
                }
              </div>
            )}
          </div>

          {/* Tabla de Pagos */}
          <div className="mobile-scroll-hint">Desliza la tabla para ver más →</div>
          <div className="table-container modern-table">
            <div className="overflow-x-auto">
              <table className="table enhanced-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Monto (Bs)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  <div className="text-slate-500">
                    {searchTerm ? 'No se encontraron pagos que coincidan con la búsqueda' : 'No hay pagos registrados'}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((pago) => {
                const registroInfo = getRegistroInfo(pago.id_registro);
                const expanded = expandedRows.has(pago.id_pago);
                return (
                  <React.Fragment key={pago.id_pago}>
                    <tr className="table-row-enhanced">
                      <td>
                        <button
                          onClick={() => toggleExpandRow(pago.id_pago)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title={expanded ? 'Ocultar detalles' : 'Ver más detalles'}
                        >
                          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td>
                        <div className="client-info">
                          <div className="client-name">{registroInfo.usuario}</div>
                        </div>
                      </td>
                      <td>
                        <div className="service-info">
                          <div className="service-type">{registroInfo.membresia}</div>
                          <div className="service-duration">{registroInfo.duracion}</div>
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell">
                          <span className="amount-paid">Bs {parseFloat(pago.monto_pagado).toFixed(2)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${
                          pago.estado_pago === 'Completo' ? 'status-complete' :
                          pago.estado_pago === 'Pendiente' ? 'status-pending' :
                          'status-partial'
                        }`}>
                          {pago.estado_pago}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => openEditModal(pago)}
                            className="btn-edit enhanced-btn-sm"
                            title="Editar pago"
                          >
                            <span className="btn-icon"><IconPencil /></span>
                          </button>
                          <button
                            onClick={() => handleDelete(pago.id_pago)}
                            className="btn-delete enhanced-btn-sm"
                            title="Eliminar pago"
                          >
                            <span className="btn-icon"><IconTrash /></span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-50">
                        <td></td>
                        <td colSpan="5" className="py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs text-slate-500">
                            <div><span className="font-semibold text-slate-600">ID:</span> {pago.id_pago} (Registro #{pago.id_registro})</div>
                            <div><span className="font-semibold text-slate-600">Precio membresía:</span> Bs {parseFloat(registroInfo.precio).toFixed(2)}</div>
                            <div>
                              <span className="font-semibold text-slate-600">Caja:</span>{' '}
                              {pago.Caja ? pago.Caja.descripcion || `Caja ${pago.id_caja}` : `Caja ${pago.id_caja}`}
                            </div>
                            <div><span className="font-semibold text-slate-600">Fecha Pago:</span> {formatearFecha(pago.fecha_pago)}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Paginación - Fijo en la parte inferior */}
      <div className="pagos-pagination">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          startItem={startItem}
          endItem={endItem}
          itemsPerPage={8}
          onPageChange={goToPage}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
        />
      </div>
        </div>
      </div>

      {/* Modal de Pago Moderno */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-container enhanced-modal compact-modal">
            {/* Header Moderno */}
            <div className="modal-header modern-header">
              <div className="header-content">
                <div className="header-icon">
                  
                </div>
                <div className="header-text">
                  <h3 className="modal-title">
                    {editingPago ? 'Editar Pago' : 'Nuevo Pago'}
                  </h3>
                  <p className="modal-subtitle">
                    {editingPago ? 'Modifica el pago' : 'Registra pago de membresía'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                className="modal-close modern-close" 
                onClick={() => closeModal()}
              >
                ✕
              </button>
            </div>
            
            {/* Body Moderno */}
            <div className="modal-body modern-body">
              <form onSubmit={handleSubmit} className="modern-form">
                {/* Sección: Búsqueda de Membresía */}
                <div className="form-section">
                  <div className="section-header">
                    <h4 className="section-title">
                      <span className="section-icon"><IconMagnifyingGlass /></span>
                      Membresía
                    </h4>
                  </div>

                  <div className="enhanced-search">
                    <div className="select-wrapper">
                      <span className="select-icon"><IconIdentification /></span>
                      <select
                        value={formData.id_registro}
                        onChange={(e) => {
                          const registroId = e.target.value;
                          if (registroId) {
                            const registroInfo = getRegistroInfo(parseInt(registroId));
                            setFormData({
                              ...formData, 
                              id_registro: registroId,
                              monto_pagado: registroInfo.precio.toString()
                            });
                          } else {
                            setFormData({...formData, id_registro: '', monto_pagado: ''});
                          }
                        }}
                        className="form-select professional"
                        size="1"
                      >
                        <option value="">Seleccionar membresía...</option>
                        {registros
                          .sort((a, b) => {
                            const infoA = getRegistroInfo(a.id_registro);
                            const infoB = getRegistroInfo(b.id_registro);
                            return infoA.usuario.localeCompare(infoB.usuario);
                          })
                          .map(registro => {
                            const registroInfo = getRegistroInfo(registro.id_registro);
                            return (
                              <option key={registro.id_registro} value={registro.id_registro}>
                                {registroInfo.usuario} • {registroInfo.membresia} • Bs. {registroInfo.precio}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    {formData.id_registro && (
                      <div className="selected-info">
                        <span className="info-badge">
                          Membresía seleccionada
                        </span>
                      </div>
                    )}
                  </div>



                  {/* Vista previa de membresía seleccionada */}
                  {formData.id_registro && (
                    <div className="membership-preview">
                      <div className="preview-header">
                        <span className="preview-icon"><IconEye /></span>
                        Vista Previa - Membresía Seleccionada
                      </div>
                      <div className="preview-content">
                        {(() => {
                          const registroInfo = getRegistroInfo(parseInt(formData.id_registro));
                          return (
                            <div className="preview-grid">
                              <div className="preview-item">
                                <span className="item-label">Cliente:</span>
                                <span className="item-value">{registroInfo.usuario}</span>
                              </div>
                              <div className="preview-item">
                                <span className="item-label">Membresía:</span>
                                <span className="item-value">{registroInfo.membresia}</span>
                              </div>
                              <div className="preview-item">
                                <span className="item-label">Precio:</span>
                                <span className="item-value price">Bs. {registroInfo.precio}</span>
                              </div>
                              <div className="preview-item">
                                <span className="item-label">ID Registro:</span>
                                <span className="item-value">#{formData.id_registro}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sección: Datos del Pago */}
                <div className="form-section">
                  <div className="section-header">
                    <h4 className="section-title">
                      <span className="section-icon"><IconBanknotes /></span>
                      Pago
                    </h4>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label className="form-label modern">
                        <span className="label-icon"><IconArchiveBox /></span>
                        Caja
                      </label>
                      <div className="enhanced-select">
                        <select
                          value={formData.id_caja}
                          onChange={(e) => setFormData({...formData, id_caja: e.target.value})}
                          className="form-select modern"
                          required
                        >
                          <option value="">Seleccionar caja</option>
                          {cajas.map(caja => (
                            <option key={caja.id_caja} value={caja.id_caja}>
                              {caja.descripcion || `Caja ${caja.id_caja}`}
                              {caja.id_caja === 1 && ' (Principal)'}
                            </option>
                          ))}
                        </select>
                        <span className="select-arrow">▼</span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label modern">
                        <span className="label-icon"><IconBanknotes /></span>
                        Monto Pagado
                        {formData.id_registro && formData.monto_pagado && (
                          <span style={{
                            fontSize: '12px',
                            color: '#059669',
                            fontWeight: '500',
                            marginLeft: '8px'
                          }}>
                            <IconCheckCircle className="w-3 h-3 inline-block" />
                          </span>
                        )}
                      </label>
                      <div className="input-wrapper currency">
                        <span className="currency-symbol">Bs.</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.monto_pagado}
                          onChange={(e) => setFormData({...formData, monto_pagado: e.target.value})}
                          className={`form-input modern currency-input ${
                            formData.id_registro && formData.monto_pagado ? 'auto-filled' : ''
                          }`}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label modern">
                        <span className="label-icon"><IconCalendar /></span>
                        Fecha de Pago
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_pago}
                        onChange={(e) => setFormData({...formData, fecha_pago: e.target.value})}
                        className="form-input modern"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label modern">
                        <span className="label-icon"><IconChartBar /></span>
                        Estado
                      </label>
                      <div className="enhanced-select">
                        <select
                          value={formData.estado_pago}
                          onChange={(e) => setFormData({...formData, estado_pago: e.target.value})}
                          className="form-select modern"
                        >
                          <option value="Completo">Completo</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="Parcial">Parcial</option>
                        </select>
                        <span className="select-arrow">▼</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="modern-actions">
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="btn-secondary modern-btn"
                  >
                    <span className="btn-icon">✕</span>
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary modern-btn"
                    disabled={!formData.id_registro || !formData.monto_pagado || !formData.id_caja}
                  >
                    <span className="btn-icon">{editingPago ? <IconPencil /> : <IconSave />}</span>
                    {editingPago ? 'Actualizar Pago' : 'Registrar Pago'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportación */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Exportar Datos de Pagos</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowExportModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="export-options">
                <div className="form-group">
                  <label>Tipo de exportación:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="tipoExportacion"
                        value="pdf"
                        checked={tipoExportacion === 'pdf'}
                        onChange={(e) => setTipoExportacion(e.target.value)}
                      />
                      <span>PDF</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="tipoExportacion"
                        value="excel"
                        checked={tipoExportacion === 'excel'}
                        onChange={(e) => setTipoExportacion(e.target.value)}
                      />
                      <span>Excel</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Filtro de fecha:</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="filtroFecha"
                        value="todos"
                        checked={filtroFecha === 'todos'}
                        onChange={(e) => setFiltroFecha(e.target.value)}
                      />
                      <span>Todos</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="filtroFecha"
                        value="semana"
                        checked={filtroFecha === 'semana'}
                        onChange={(e) => setFiltroFecha(e.target.value)}
                      />
                      <span>Última semana</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="filtroFecha"
                        value="mes"
                        checked={filtroFecha === 'mes'}
                        onChange={(e) => setFiltroFecha(e.target.value)}
                      />
                      <span>Último mes</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="filtroFecha"
                        value="personalizado"
                        checked={filtroFecha === 'personalizado'}
                        onChange={(e) => setFiltroFecha(e.target.value)}
                      />
                      <span>Rango personalizado</span>
                    </label>
                  </div>
                </div>

                {filtroFecha === 'personalizado' && (
                  <div className="date-range-group">
                    <div className="form-group">
                      <label>Fecha inicio:</label>
                      <input
                        type="date"
                        className="form-input"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha fin:</label>
                      <input
                        type="date"
                        className="form-input"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="export-preview">
                  <strong>Vista previa:</strong> Se exportarán {filtrarPagosPorFecha().length} pagos
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowExportModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleExportar}
                disabled={filtroFecha === 'personalizado' && (!fechaInicio || !fechaFin)}
              >
                Exportar {tipoExportacion.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablaPagos;