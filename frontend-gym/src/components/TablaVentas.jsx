import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import Button from './ui/Button';
import SearchBar from './ui/SearchBar';
import Pagination from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import TablaPagos from './TablaPagos';
import { IconDocumentDownload, IconPencil, IconTrash, IconEye, IconUser, IconShoppingCart, IconArchiveBox, IconCalendar, IconChartBar, IconCheckCircle, IconSave, IconBanknotes } from './ui/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import '../styles/tables.css';
import '../styles/modals.css';
import '../styles/modern-modals.css';

const TablaVentas = () => {
  const [activeTab, setActiveTab] = useState('ventas');
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showVentaModal, setShowVentaModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [editingVenta, setEditingVenta] = useState(null);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);

  // Filas expandidas ("Ver más") para mostrar ID, caja y fecha
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleExpandRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  
  // Estados para exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [tipoExportacion, setTipoExportacion] = useState('pdf');
  const [filtroFecha, setFiltroFecha] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Estados para el modal de venta
  const [usuarios, setUsuarios] = useState([]);
  const [administrativos, setAdministrativos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [searchProducto, setSearchProducto] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [isProductSelected, setIsProductSelected] = useState(false);
  
  // Estados para búsqueda de clientes
  const [searchCliente, setSearchCliente] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [isClienteSelected, setIsClienteSelected] = useState(false);
  
  // Estados para selector de productos
  // Función para obtener fecha local en formato YYYY-MM-DD
  const getFechaHoyLocal = () => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const [showProductList, setShowProductList] = useState(false);
  const [formData, setFormData] = useState({
    id_usuario: '',
    id_admin: '',
    id_caja: '',
    fecha_venta: '', // Se establecerá con fecha local
    total: '',
    estado: 'Completada'
  });

  // Filtrar ventas
  const filteredVentas = ventas.filter(venta => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const usuarioNombre = venta.Usuario ? 
      `${venta.Usuario.nombre} ${venta.Usuario.apellido}`.toLowerCase() : '';
    
    // Buscar en productos de los detalles
    const productosNombres = venta.Detalles ? 
      venta.Detalles.map(detalle => 
        detalle.Producto ? detalle.Producto.nombre.toLowerCase() : ''
      ).join(' ') : '';
    
    return (
      venta.id_venta.toString().includes(searchLower) ||
      usuarioNombre.includes(searchLower) ||
      venta.estado.toLowerCase().includes(searchLower) ||
      venta.total.toString().includes(searchLower) ||
      productosNombres.includes(searchLower)
    );
  });

  // Funciones de exportación
  const filtrarVentasPorFecha = () => {
    let ventasFiltradas = [...ventas];

    switch (filtroFecha) {
      case 'semana':
        const semanaAtras = new Date();
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        ventasFiltradas = ventas.filter(venta => {
          const fechaVenta = new Date(venta.fecha_venta);
          return fechaVenta >= semanaAtras;
        });
        break;
      case 'mes':
        const mesAtras = new Date();
        mesAtras.setMonth(mesAtras.getMonth() - 1);
        ventasFiltradas = ventas.filter(venta => {
          const fechaVenta = new Date(venta.fecha_venta);
          return fechaVenta >= mesAtras;
        });
        break;
      case 'personalizado':
        if (fechaInicio && fechaFin) {
          ventasFiltradas = ventas.filter(venta => {
            const fechaVenta = new Date(venta.fecha_venta);
            return fechaVenta >= new Date(fechaInicio) && fechaVenta <= new Date(fechaFin);
          });
        }
        break;
      default:
        break;
    }

    return ventasFiltradas;
  };

  const exportarPDF = () => {
    const ventasFiltradas = filtrarVentasPorFecha();
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Reporte de Ventas - Gimnasio', 20, 20);

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
    doc.text(`Total de ventas: ${ventasFiltradas.length}`, 20, 45);
    doc.text(`Total monetario: Bs. ${ventasFiltradas.reduce((sum, v) => sum + parseFloat(v.total), 0).toFixed(2)}`, 20, 55);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 20, 65);

    const tableData = ventasFiltradas.map(venta => [
      venta.id_venta,
      venta.Usuario ? `${venta.Usuario.nombre} ${venta.Usuario.apellido}` : 'Cliente no encontrado',
      venta.Administrativo ? `${venta.Administrativo.nombre} ${venta.Administrativo.apellido}` : `Admin ID: ${venta.id_admin}`,
      new Date(venta.fecha_venta).toLocaleDateString(),
      `Bs. ${venta.total}`
    ]);

    autoTable(doc, {
      head: [['ID', 'Cliente', 'Vendedor', 'Fecha', 'Total']],
      body: tableData,
      startY: 75,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const fechaArchivo = new Date().toISOString().split('T')[0];
    doc.save(`ventas_${filtroFecha}_${fechaArchivo}.pdf`);

    setShowExportModal(false);
  };

  const exportarExcel = () => {
    const ventasFiltradas = filtrarVentasPorFecha();
    
    const datosExcel = ventasFiltradas.map(venta => ({
      'ID Venta': venta.id_venta,
      'Cliente': venta.Usuario ? `${venta.Usuario.nombre} ${venta.Usuario.apellido}` : 'Cliente no encontrado',
      'Email Cliente': venta.Usuario?.email || 'N/A',
      'Teléfono Cliente': venta.Usuario?.telefono || 'N/A',
      'Vendedor': venta.Administrativo ? `${venta.Administrativo.nombre} ${venta.Administrativo.apellido}` : `Admin ID: ${venta.id_admin}`,
      'Caja': venta.Caja ? venta.Caja.descripcion : `Caja ID: ${venta.id_caja}`,
      'Fecha Venta': new Date(venta.fecha_venta).toLocaleDateString(),
      'Total': `Bs. ${venta.total}`,
      'ID Admin': venta.id_admin,
      'ID Caja': venta.id_caja
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

    const totalVentas = ventasFiltradas.reduce((sum, v) => sum + parseFloat(v.total), 0);
    const resumenData = [
      ['REPORTE DE VENTAS - GIMNASIO'],
      [''],
      ['Filtro aplicado:', filtroFecha === 'personalizado' ? `${fechaInicio} a ${fechaFin}` : filtroFecha],
      ['Total de ventas:', ventasFiltradas.length],
      ['Monto total:', `Bs. ${totalVentas.toFixed(2)}`],
      ['Promedio por venta:', `Bs. ${(totalVentas / ventasFiltradas.length || 0).toFixed(2)}`],
      ['Fecha de generación:', new Date().toLocaleDateString()],
      ['Hora de generación:', new Date().toLocaleTimeString()]
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen');

    const fechaArchivo = new Date().toISOString().split('T')[0];
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `ventas_${filtroFecha}_${fechaArchivo}.xlsx`);

    setShowExportModal(false);
  };

  const handleExportar = () => {
    if (tipoExportacion === 'pdf') {
      exportarPDF();
    } else {
      exportarExcel();
    }
  };
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
  } = usePagination(filteredVentas, 8);

  const paginatedData = filteredVentas.slice(startItem - 1, endItem);

  // Filtrar productos para la búsqueda
  const filteredProductos = productos.filter(producto => {
    if (!searchProducto) return true;
    const searchLower = searchProducto.toLowerCase();
    return (
      producto.nombre.toLowerCase().includes(searchLower) ||
      (producto.descripcion && producto.descripcion.toLowerCase().includes(searchLower)) ||
      producto.precio.toString().includes(searchLower)
    );
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadVentas();
    loadSelectData();
  }, []);

  const loadVentas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ventas');
      setVentas(response.data);
    } catch (error) {
      console.error('Error:', error);
      setError('Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  const loadSelectData = async () => {
    try {
      const [usuariosRes, adminsRes, cajasRes, productosRes] = await Promise.all([
        api.get('/usuarios'),
        api.get('/administrativos'),
        api.get('/cajas'),
        api.get('/productos')
      ]);

      setUsuarios(usuariosRes.data);
      setAdministrativos(adminsRes.data);
      setCajas(cajasRes.data);
      setProductos(productosRes.data);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    goToPage(1);
  };

  const openCreateModal = () => {
    setEditingVenta(null);
    setSearchProducto('');
    setSelectedProducto(null);
    setIsProductSelected(false);
    setSearchCliente('');
    setSelectedCliente(null);
    setIsClienteSelected(false);
    setShowProductList(false);
    const fechaHoy = getFechaHoyLocal();
    setFormData({
      id_usuario: '',
      id_admin: '1', // Auto-seleccionar admin logueado
      id_caja: '1', // Caja por defecto
      fecha_venta: fechaHoy, // Fecha local segura
      total: '',
      estado: 'Completada'
    });
    setShowVentaModal(true);
  };

  const openEditModal = (venta) => {
    setEditingVenta(venta);
    setSearchProducto('');
    setSelectedProducto(null);
    setIsProductSelected(false);
    setFormData({
      id_usuario: venta.id_usuario,
      id_admin: venta.id_admin,
      id_caja: venta.id_caja,
      fecha_venta: venta.fecha_venta ? venta.fecha_venta.split('T')[0] : getFechaHoyLocal(),
      total: venta.total,
      estado: venta.estado
    });
    setShowVentaModal(true);
  };

  const openDetalleModal = (venta) => {
    setSelectedVenta(venta);
    setShowDetalleModal(true);
  };

  const closeVentaModal = () => {
    setShowVentaModal(false);
    setSearchProducto('');
    setSelectedProducto(null);
    setIsProductSelected(false);
    setSearchCliente('');
    setSelectedCliente(null);
    setIsClienteSelected(false);
    setShowProductList(false);
    setEditingVenta(null);
    setFormData({
      id_usuario: '',
      id_admin: '',
      id_caja: '1',
      fecha_venta: new Date().toISOString().split('T')[0],
      total: '',
      estado: 'Completada'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let ventaResponse;
      if (editingVenta) {
        ventaResponse = await api.put(`/ventas/${editingVenta.id_venta}`, formData);
      } else {
        // Solo crear la venta - el trigger automáticamente maneja el movimiento de caja
        ventaResponse = await api.post('/ventas', formData);
      }

      // *** NOTA: El trigger de la base de datos automáticamente:
      // 1. Actualiza el saldo de la caja
      // 2. Crea el movimiento en movimientos_caja
      // NO necesitamos crear movimientos manualmente aquí ***

      await loadVentas();
      closeVentaModal();
      
      // Mostrar check de éxito
      setShowSuccessCheck(true);
      setTimeout(() => setShowSuccessCheck(false), 3000);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la venta');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de que desea eliminar esta venta?\n\nEsto restará el monto de la venta de la caja correspondiente y restaurará el stock de los productos.')) return;

    try {
      const response = await api.delete(`/ventas/${id}`);
      const resultado = response.data;

      await loadVentas();
      
      // Mostrar notificación detallada con información de la caja y productos
      if (resultado.cajaAfectada) {
        alert(
          `Venta eliminada exitosamente\n\n` +
          `Monto total: Bs. ${resultado.montoVenta}\n` +
          `Cliente: ${resultado.cliente}\n` +
          `Productos restaurados: ${resultado.productosRestaurados}\n\n` +
          `Caja afectada: ${resultado.cajaAfectada.descripcion}\n` +
          `Saldo anterior: Bs. ${resultado.cajaAfectada.saldoAnterior}\n` +
          `Saldo actual: Bs. ${resultado.cajaAfectada.saldoActual}\n` +
          `Diferencia: Bs. ${resultado.cajaAfectada.diferencia}`
        );
      } else {
        alert('Venta eliminada exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error.response?.data?.error || 'Error al eliminar la venta';
      alert(`Error: ${errorMsg}`);
    }
  };

  if (loading) return <div className="text-center py-8 text-slate-900">Cargando ventas...</div>;
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>;

  // Si está en la tab de pagos, mostrar TablaPagos
  if (activeTab === 'pagos') {
    return <TablaPagos />;
  }

  return (
    <div className="ventas-container">
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
            <span>¡Venta registrada exitosamente!</span>
          </div>
        </div>
      )}

      {/* Contenido scrolleable */}
      <div className="ventas-content-wrapper">
        <div className="ventas-content">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-900">Gestión de Ventas</h2>
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
            Nueva Venta
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        placeholder="Buscar por cliente, productos, total, estado..."
      />

      {/* Tabla de Ventas */}
      <div className="table-container modern-table">
        <div className="overflow-x-auto">
          <table className="table enhanced-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Total (Bs)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  <div className="text-slate-500">
                    {searchTerm ? 'No se encontraron ventas que coincidan con la búsqueda' : 'No hay ventas registradas'}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((venta) => {
                const expanded = expandedRows.has(venta.id_venta);
                return (
                  <React.Fragment key={venta.id_venta}>
                    <tr className="table-row-enhanced">
                      <td>
                        <button
                          onClick={() => toggleExpandRow(venta.id_venta)}
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
                          <div className="client-name">
                            {venta.Usuario ?
                              `${venta.Usuario.nombre} ${venta.Usuario.apellido}` :
                              `ID: ${venta.id_usuario}`
                            }
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="product-info">
                          <div className="product-summary">
                            {venta.Detalles && venta.Detalles.length > 0 ?
                              `${venta.Detalles.length} producto(s)` :
                              'Sin detalles'
                            }
                          </div>
                          {venta.Detalles && venta.Detalles.length > 0 && (
                            <div className="product-preview">
                              {venta.Detalles.slice(0, 2).map((detalle, idx) => (
                                <span key={idx} className="product-item">
                                  {detalle.Producto ? detalle.Producto.nombre : `Producto ${detalle.id_producto}`}
                                  {idx < Math.min(venta.Detalles.length, 2) - 1 && ', '}
                                </span>
                              ))}
                              {venta.Detalles.length > 2 && <span className="more-products">...</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell">
                          <span className="total-amount">Bs {parseFloat(venta.total).toFixed(2)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${
                          venta.estado === 'Completada' ? 'status-complete' :
                          venta.estado === 'Pendiente' ? 'status-pending' :
                          'status-partial'
                        }`}>
                          {venta.estado}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => openDetalleModal(venta)}
                            className="btn-info enhanced-btn-sm"
                            title="Ver detalle"
                          >
                            <span className="btn-icon"><IconEye /></span>
                          </button>
                          <button
                            onClick={() => openEditModal(venta)}
                            className="btn-edit enhanced-btn-sm"
                            title="Editar venta"
                          >
                            <span className="btn-icon"><IconPencil /></span>
                          </button>
                          <button
                            onClick={() => handleDelete(venta.id_venta)}
                            className="btn-delete enhanced-btn-sm"
                            title="Eliminar venta"
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
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                            <div><span className="font-semibold text-slate-600">ID:</span> {venta.id_venta}</div>
                            <div>
                              <span className="font-semibold text-slate-600">Caja:</span>{' '}
                              {venta.Caja ? venta.Caja.descripcion || `Caja ${venta.id_caja}` : `Caja ${venta.id_caja}`}
                            </div>
                            <div><span className="font-semibold text-slate-600">Fecha:</span> {new Date(venta.fecha_venta).toLocaleDateString()}</div>
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
      <div className="ventas-pagination">
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

      {/* Modal de Venta Moderno */}
      {showVentaModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeVentaModal()}>
          <div className="modal-container enhanced-modal compact-modal">
            {/* Header Moderno */}
            <div className="modal-header modern-header">
              <div className="header-content">
                <div className="header-icon">
                  <IconShoppingCart className="w-6 h-6" />
                </div>
                <div className="header-text">
                  <h3 className="modal-title">
                    {editingVenta ? 'Editar Venta' : 'Nueva Venta'}
                  </h3>
                  <p className="modal-subtitle">
                    {editingVenta ? 'Modifica los datos de la venta existente' : 'Registra una nueva venta de productos'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                className="modal-close modern-close" 
                onClick={() => closeVentaModal()}
              >
                ✕
              </button>
            </div>
            
            {/* Body Moderno */}
            <div className="modal-body modern-body">
              <form onSubmit={handleSubmit} className="modern-form">
                {/* Sección: Información del Cliente */}
                <div className="form-section">
                  <div className="section-header">
                    <h4 className="section-title">
                      <span className="section-icon"><IconUser /></span>
                      Cliente y Venta
                    </h4>
                  </div>

                  <div>
                    <label className="form-label modern">
                      <span className="label-icon"><IconUser /></span>
                                              Cliente
                      {selectedCliente && formData.id_usuario && (
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
                    <div className="search-container">
                      <input
                        type="text"
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        className={`form-input modern search-input ${isClienteSelected && formData.id_usuario ? 'auto-filled' : ''}`}
                        placeholder="Buscar cliente..."
                        autoComplete="off"
                      />
                      {searchCliente && (
                        <button
                          type="button"
                          className="clear-search"
                          onClick={() => {
                            setSearchCliente('');
                            setSelectedCliente(null);
                            setIsClienteSelected(false);
                            setFormData({...formData, id_usuario: ''});
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Resultados de búsqueda de clientes */}
                    {searchCliente && searchCliente.length >= 2 && (
                      <div className="search-results-container">
                        {usuarios.filter(usuario => 
                          `${usuario.nombre} ${usuario.apellido}`.toLowerCase().includes(searchCliente.toLowerCase())
                        ).length > 0 ? (
                          usuarios
                            .filter(usuario => 
                              `${usuario.nombre} ${usuario.apellido}`.toLowerCase().includes(searchCliente.toLowerCase())
                            )
                            .slice(0, 4)
                            .map(usuario => {
                              return (
                                <div
                                  key={usuario.id_usuario}
                                  className="search-result-card minimal"
                                  onClick={() => {
                                    setSelectedCliente(usuario);
                                    setIsClienteSelected(true);
                                    setFormData({...formData, id_usuario: usuario.id_usuario});
                                    setSearchCliente(`${usuario.nombre} ${usuario.apellido}`);
                                  }}
                                >
                                  <div className="result-minimal-content">
                                    <div className="result-primary">
                                      <span className="result-name">{usuario.nombre} {usuario.apellido}</span>
                                    </div>
                                    <div className="result-secondary">
                                      <span className="result-detail">#{usuario.id_usuario}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        ) : (
                          <div className="no-results">
                            <p className="no-results-text">
                              Sin resultados
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vista previa del cliente seleccionado */}
                    {selectedCliente && (
                      <div className="membership-preview">
                        <div className="preview-header">
                          <span className="preview-icon"><IconEye /></span>
                          Cliente Seleccionado
                        </div>
                        <div className="preview-content">
                          <div className="preview-grid">
                            <div className="preview-item">
                              <span className="item-label">Nombre:</span>
                              <span className="item-value">{selectedCliente.nombre} {selectedCliente.apellido}</span>
                            </div>
                            <div className="preview-item">
                              <span className="item-label">Email:</span>
                              <span className="item-value">{selectedCliente.email || 'No registrado'}</span>
                            </div>
                            <div className="preview-item">
                              <span className="item-label">Teléfono:</span>
                              <span className="item-value">{selectedCliente.telefono || 'No registrado'}</span>
                            </div>
                            <div className="preview-item">
                              <span className="item-label">ID Cliente:</span>
                              <span className="item-value">#{selectedCliente.id_usuario}</span>
                            </div>
                          </div>
                          {selectedCliente.fecha_registro && (
                            <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Fecha de registro:</span>
                              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#374151' }}>
                                {new Date(selectedCliente.fecha_registro).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección: Selección de Productos */}
                <div className="form-section">
                  <div className="section-header">
                    <h4 className="section-title">
                      <span className="section-icon"><IconShoppingCart /></span>
                      Producto
                    </h4>
                  </div>

                  <div>
                    <label className="form-label modern">
                      <span className="label-icon"><IconShoppingCart /></span>
                      Producto
                      {selectedProducto && (
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

                    {/* Selector de productos con botón deslizable */}
                    {!selectedProducto ? (
                      <div className="product-selector">
                        <button
                          type="button"
                          className="btn-secondary modern-btn product-selector-btn"
                          onClick={() => setShowProductList(!showProductList)}
                        >
                          <span className="label-icon"><IconShoppingCart /></span>
                          Seleccionar Producto
                          <span className="select-arrow">{showProductList ? '▲' : '▼'}</span>
                        </button>
                        
                        {showProductList && (
                          <div className="product-list-container">
                            {productos.map(producto => (
                              <div
                                key={producto.id_producto}
                                className="product-item"
                                onClick={() => {
                                  setSelectedProducto(producto);
                                  setIsProductSelected(true);
                                  setFormData({...formData, total: producto.precio.toString()});
                                  setShowProductList(false);
                                }}
                              >
                                <div className="product-info">
                                  <span className="product-name">{producto.nombre}</span>
                                  <span className="product-price">Bs. {parseFloat(producto.precio).toFixed(2)}</span>
                                </div>
                                <div className="product-stock">Stock: {producto.stock}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="selected-product-display">
                        <div className="product-display-content">
                          <span className="selected-product-name">{selectedProducto.nombre}</span>
                          <span className="selected-product-price">Bs. {parseFloat(selectedProducto.precio).toFixed(2)}</span>
                          <button
                            type="button"
                            className="change-product-btn"
                            onClick={() => {
                              setSelectedProducto(null);
                              setIsProductSelected(false);
                              setFormData({...formData, total: ''});
                              setShowProductList(true);
                            }}
                          >
                            Cambiar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección: Datos de la Venta */}
                <div className="form-section">
                  <div className="section-header">
                    <h4 className="section-title">
                      <span className="section-icon"><IconArchiveBox /></span>
                      Datos de la Venta
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
                        <span className="label-icon"><IconCalendar /></span>
                        Fecha de Venta
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_venta}
                        onChange={(e) => setFormData({...formData, fecha_venta: e.target.value})}
                        className="form-input modern"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label modern">
                        <span className="label-icon"><IconBanknotes /></span>
                        Total de Venta
                        {selectedProducto && formData.total && (
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#059669', 
                            fontWeight: '500',
                            marginLeft: '8px'
                          }}>
                            Auto-completado
                          </span>
                        )}
                      </label>
                      <div className="input-wrapper currency">
                        <span className="currency-symbol">Bs.</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.total}
                          onChange={(e) => setFormData({...formData, total: e.target.value})}
                          className={`form-input modern currency-input ${isProductSelected && formData.total ? 'auto-filled' : ''}`}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label modern">
                        <span className="label-icon"><IconChartBar /></span>
                        Estado de la Venta
                      </label>
                      <div className="enhanced-select">
                        <select
                          value={formData.estado}
                          onChange={(e) => setFormData({...formData, estado: e.target.value})}
                          className="form-select modern"
                        >
                          <option value="Completada">Completada</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="Cancelada">Cancelada</option>
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
                    onClick={() => closeVentaModal()}
                    className="btn-secondary modern-btn"
                  >
                    <span className="btn-icon">✕</span>
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary modern-btn"
                    disabled={!formData.id_usuario || !formData.id_admin || !formData.id_caja || !formData.total}
                  >
                    <span className="btn-icon">{editingVenta ? <IconPencil /> : <IconSave />}</span>
                    {editingVenta ? 'Actualizar Venta' : 'Registrar Venta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Venta - Simplificado */}
      {showDetalleModal && selectedVenta && (
        <div className="simple-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDetalleModal(false)}>
          <div className="simple-modal-container">
            <div className="simple-modal-header">
              <h3>Detalle de Venta #{selectedVenta.id_venta}</h3>
              <button 
                onClick={() => setShowDetalleModal(false)}
                className="simple-modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="simple-modal-body">
              {/* Información General */}
              <div className="simple-info-section">
                <h4>Información General</h4>
                <div className="simple-info-grid">
                  <div><strong>Cliente:</strong> {selectedVenta.Usuario ? `${selectedVenta.Usuario.nombre} ${selectedVenta.Usuario.apellido}` : 'N/A'}</div>
                  <div><strong>Administrativo:</strong> {selectedVenta.Administrativo ? `${selectedVenta.Administrativo.nombre} ${selectedVenta.Administrativo.apellido}` : 'N/A'}</div>
                  <div><strong>Caja:</strong> {selectedVenta.Caja ? selectedVenta.Caja.descripcion || `Caja ${selectedVenta.id_caja}` : 'N/A'}</div>
                  <div><strong>Fecha:</strong> {new Date(selectedVenta.fecha_venta).toLocaleDateString('es-ES')}</div>
                  <div><strong>Estado:</strong>
                    <span className={selectedVenta.estado === 'Completada' ? 'text-emerald-600' : selectedVenta.estado === 'Pendiente' ? 'text-amber-600' : 'text-red-600'}>
                      {' '}{selectedVenta.estado}
                    </span>
                  </div>
                </div>
              </div>

              {/* Productos */}
              <div className="simple-info-section">
                <h4>Productos Vendidos</h4>
                <div className="simple-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio Unit.</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVenta.Detalles && selectedVenta.Detalles.length > 0 ? (
                        selectedVenta.Detalles.map((detalle, index) => (
                          <tr key={index}>
                            <td>
                              <div>
                                <strong>{detalle.Producto ? detalle.Producto.nombre : `Producto ID: ${detalle.id_producto}`}</strong>
                                {detalle.Producto?.descripcion && <br />}
                                <small className="text-slate-500">{detalle.Producto?.descripcion}</small>
                              </div>
                            </td>
                            <td className="text-center">
                              <span className="quantity-badge">{detalle.cantidad}x</span>
                            </td>
                            <td className="text-emerald-600"><strong>Bs. {parseFloat(detalle.precio_unitario).toFixed(2)}</strong></td>
                            <td className="text-indigo-600"><strong>Bs. {parseFloat(detalle.subtotal).toFixed(2)}</strong></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center text-slate-500 py-4">
                            No hay productos registrados en esta venta
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="simple-total-section">
                <div className="simple-total">
                  Total: <strong>Bs. {parseFloat(selectedVenta.total).toFixed(2)}</strong>
                </div>
                <div className="simple-total-note">
                  Bolivianos • Venta #{selectedVenta.id_venta}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportación */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Exportar Datos de Ventas</h3>
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
                  <strong>Vista previa:</strong> Se exportarán {filtrarVentasPorFecha().length} ventas
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

export default TablaVentas;