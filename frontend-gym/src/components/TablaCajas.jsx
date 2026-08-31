'use client';
import { useState, useEffect } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import SearchBar from './ui/SearchBar';
import Pagination from './ui/Pagination';
import Badge from './ui/Badge';
import { usePagination } from '../hooks/usePagination';
import api from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import '../styles/tables.css';
import '../styles/modals.css';

export default function TablaCajas() {
  const [cajas, setCajas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [administrativos, setAdministrativos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showMovimientosModal, setShowMovimientosModal] = useState(false);
  const [editingCaja, setEditingCaja] = useState(null);
  const [selectedCaja, setSelectedCaja] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);
  
  // Estados para filtros del historial
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialFechaInicio, setHistorialFechaInicio] = useState('');
  const [historialFechaFin, setHistorialFechaFin] = useState('');
  const [historialAdminFilter, setHistorialAdminFilter] = useState('');
  const [historialTipoFilter, setHistorialTipoFilter] = useState('');
  const [historialOrigenFilter, setHistorialOrigenFilter] = useState('');
  
  // Estados para exportación avanzada
  const [showExportModal, setShowExportModal] = useState(false);
  const [tipoExportacion, setTipoExportacion] = useState('pdf');
  const [incluirMovimientos, setIncluirMovimientos] = useState(true);
  const [filtroFechaExport, setFiltroFechaExport] = useState('todos');
  const [fechaInicioExport, setFechaInicioExport] = useState('');
  const [fechaFinExport, setFechaFinExport] = useState('');
  const [cajasSeleccionadas, setCajasSeleccionadas] = useState([]);
  
  const [formData, setFormData] = useState({
    descripcion: '',
    saldo_inicial: '',
    abierta: true
  });
  const [movimientoFormData, setMovimientoFormData] = useState({
    id_caja: '',
    id_admin: '1', // Por defecto
    tipo_movimiento: 'Ingreso',
    descripcion: '',
    monto: '',
    origen: 'Otro'
  });

  // Configuración de paginación
  const itemsPerPage = 8;
  
  // Asegurar que cajas sea siempre un array
  const cajasArray = Array.isArray(cajas) ? cajas : [];
  
  const { 
    currentPage, 
    totalPages, 
    paginatedData, 
    goToPage, 
    nextPage: goToNextPage,
    prevPage: goToPreviousPage
  } = usePagination(cajasArray.filter(caja => 
    caja.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  ), itemsPerPage);

  // Asegurar que paginatedData sea siempre un array
  const paginatedItems = Array.isArray(paginatedData) ? paginatedData : [];

  useEffect(() => {
    fetchCajas();
    fetchAdministrativos();
    fetchMovimientos();
  }, []);

  // Manejar tecla Escape para cerrar modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showModal) {
        closeModal();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showModal]);

  const fetchCajas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cajas');
      
      // Asegurar que la respuesta sea un array
      const data = response.data || response || [];
      const cajasData = Array.isArray(data) ? data : [];
      
      setCajas(cajasData);
      console.log('Cajas cargadas:', cajasData);
    } catch (error) {
      console.error('Error al obtener cajas:', error);
      setCajas([]); // Asegurar que sea un array vacío en caso de error
      
      // Mostrar mensaje de error más específico
      if (error.response?.status === 404) {
        console.log('Endpoint /cajas no encontrado');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('No se puede conectar al servidor backend');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMovimientos = async () => {
    try {
      const response = await api.get('/movimientos-caja');
      setMovimientos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al obtener movimientos:', error);
      setMovimientos([]);
    }
  };

  const fetchAdministrativos = async () => {
    try {
      const response = await api.get('/administrativos');
      setAdministrativos(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al obtener administrativos:', error);
      setAdministrativos([]);
    }
  };

  const getFechaHoyLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.descripcion.trim()) {
      alert('Por favor, ingrese una descripción para la caja');
      return;
    }

    try {
      const cajaData = {
        descripcion: formData.descripcion.trim(),
        saldo_inicial: parseFloat(formData.saldo_inicial) || 0,
        saldo_actual: parseFloat(formData.saldo_inicial) || 0,
        abierta: formData.abierta,
        fecha_apertura: getFechaHoyLocal()
      };

      if (editingCaja) {
        // No permitir editar saldo_inicial en edición, solo descripción y estado
        const updateData = {
          descripcion: cajaData.descripcion,
          abierta: cajaData.abierta
        };
        await api.put(`/cajas/${editingCaja.id_caja}`, updateData);
      } else {
        await api.post('/cajas', cajaData);
      }

      await fetchCajas();
      closeModal();
    } catch (error) {
      console.error('Error al guardar caja:', error);
      alert('Error al guardar la caja');
    }
  };

  const handleEdit = (caja) => {
    setEditingCaja(caja);
    setFormData({
      descripcion: caja.descripcion || '',
      saldo_inicial: caja.saldo_inicial?.toString() || '0',
      abierta: caja.abierta
    });
    setShowModal(true);
  };

  const handleToggleEstado = async (caja) => {
    const nuevoEstado = !caja.abierta;
    const accion = nuevoEstado ? 'abrir' : 'cerrar';
    
    if (window.confirm(`¿Estás seguro de que deseas ${accion} la caja "${caja.descripcion}"?`)) {
      try {
        await api.put(`/cajas/${caja.id_caja}`, { abierta: nuevoEstado });
        await fetchCajas();
      } catch (error) {
        console.error('Error al cambiar estado de caja:', error);
        alert('Error al cambiar el estado de la caja');
      }
    }
  };

  const handleDelete = async (caja) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la caja "${caja.descripcion}"?\n\nEsta acción no se puede deshacer.`)) {
      try {
        await api.delete(`/cajas/${caja.id_caja}`);
        await fetchCajas();
      } catch (error) {
        console.error('Error al eliminar caja:', error);
        alert('Error al eliminar la caja. Verifica que no tenga transacciones asociadas.');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCaja(null);
    setFormData({
      descripcion: '',
      saldo_inicial: '',
      abierta: true
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0.00';
    const numPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    return numPrice.toFixed(2);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Descripción', 'Fecha Apertura', 'Saldo Inicial', 'Saldo Actual', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...cajasArray.map(caja => [
        caja.id_caja,
        `"${caja.descripcion || ''}"`,
        caja.fecha_apertura || '',
        formatPrice(caja.saldo_inicial),
        formatPrice(caja.saldo_actual),
        caja.abierta ? 'Abierta' : 'Cerrada'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cajas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Funciones de exportación avanzada
  const obtenerDatosExportacion = () => {
    let movimientosFiltrados = [...movimientos];
    let cajasAExportar = cajasSeleccionadas.length > 0 ? 
      cajasArray.filter(caja => cajasSeleccionadas.includes(caja.id_caja)) : 
      cajasArray;

    // Filtrar por fechas si está configurado
    if (filtroFechaExport !== 'todos') {
      const ahora = new Date();
      let fechaInicio;

      switch (filtroFechaExport) {
        case 'semana':
          fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'mes':
          fechaInicio = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'trimestre':
          fechaInicio = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'personalizado':
          if (fechaInicioExport && fechaFinExport) {
            fechaInicio = new Date(fechaInicioExport);
            const fechaFin = new Date(fechaFinExport);
            movimientosFiltrados = movimientosFiltrados.filter(mov => {
              const fechaMov = new Date(mov.fecha_movimiento);
              return fechaMov >= fechaInicio && fechaMov <= fechaFin;
            });
          }
          break;
        default:
          break;
      }

      if (fechaInicio && filtroFechaExport !== 'personalizado') {
        movimientosFiltrados = movimientosFiltrados.filter(mov => {
          const fechaMov = new Date(mov.fecha_movimiento);
          return fechaMov >= fechaInicio;
        });
      }
    }

    // Filtrar movimientos por cajas seleccionadas
    if (cajasSeleccionadas.length > 0) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        cajasSeleccionadas.includes(mov.id_caja)
      );
    }

    return { cajasAExportar, movimientosFiltrados };
  };

  const exportarPDF = () => {
    const { cajasAExportar, movimientosFiltrados } = obtenerDatosExportacion();
    const doc = new jsPDF();

    // Título del documento
    doc.setFontSize(20);
    doc.text('Reporte Completo de Cajas - Gimnasio', 20, 20);

    doc.setFontSize(12);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 20, 35);
    doc.text(`Total de cajas: ${cajasAExportar.length}`, 20, 45);
    
    let yPosition = 60;

    // Tabla de resumen de cajas
    const cajasData = cajasAExportar.map(caja => [
      caja.id_caja,
      caja.descripcion || 'Sin descripción',
      formatDate(caja.fecha_apertura),
      `Bs. ${formatPrice(caja.saldo_inicial)}`,
      `Bs. ${formatPrice(caja.saldo_actual)}`,
      caja.abierta ? 'Abierta' : 'Cerrada'
    ]);

    autoTable(doc, {
      head: [['ID', 'Descripción', 'Fecha Apertura', 'Saldo Inicial', 'Saldo Actual', 'Estado']],
      body: cajasData,
      startY: yPosition,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] },
      margin: { top: 10 }
    });

    yPosition = doc.lastAutoTable.finalY + 20;

    if (incluirMovimientos && movimientosFiltrados.length > 0) {
      // Título de movimientos
      doc.setFontSize(16);
      doc.text('Historial de Movimientos', 20, yPosition);
      yPosition += 15;

      // Tabla de movimientos
      const movimientosData = movimientosFiltrados.map(mov => {
        const caja = cajasArray.find(c => c.id_caja === mov.id_caja);
        const admin = administrativos.find(a => a.id_admin === mov.id_admin);
        
        return [
          mov.id_movimiento,
          caja?.descripcion || `Caja ${mov.id_caja}`,
          `${admin?.nombre || 'N/A'} ${admin?.apellido || ''}`.trim(),
          mov.tipo_movimiento,
          mov.origen || 'N/A',
          mov.descripcion || 'Sin descripción',
          `Bs. ${formatPrice(mov.monto)}`,
          formatDate(mov.fecha_movimiento)
        ];
      });

      autoTable(doc, {
        head: [['ID', 'Caja', 'Administrador', 'Tipo', 'Origen', 'Descripción', 'Monto', 'Fecha']],
        body: movimientosData,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
        columnStyles: {
          5: { cellWidth: 30 }, // Descripción
          6: { halign: 'right' }, // Monto
        }
      });

      yPosition = doc.lastAutoTable.finalY + 15;
    }

    // Resumen financiero
    const totalSaldoInicial = cajasAExportar.reduce((sum, caja) => sum + (parseFloat(caja.saldo_inicial) || 0), 0);
    const totalSaldoActual = cajasAExportar.reduce((sum, caja) => sum + (parseFloat(caja.saldo_actual) || 0), 0);
    const totalIngresos = movimientosFiltrados
      .filter(mov => mov.tipo_movimiento === 'Ingreso')
      .reduce((sum, mov) => sum + (parseFloat(mov.monto) || 0), 0);
    const totalEgresos = movimientosFiltrados
      .filter(mov => mov.tipo_movimiento === 'Egreso')
      .reduce((sum, mov) => sum + (parseFloat(mov.monto) || 0), 0);

    doc.setFontSize(14);
    doc.text('Resumen Financiero:', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.text(`Total Saldo Inicial: Bs. ${totalSaldoInicial.toFixed(2)}`, 20, yPosition);
    doc.text(`Total Saldo Actual: Bs. ${totalSaldoActual.toFixed(2)}`, 20, yPosition + 10);
    doc.text(`Total Ingresos: Bs. ${totalIngresos.toFixed(2)}`, 20, yPosition + 20);
    doc.text(`Total Egresos: Bs. ${totalEgresos.toFixed(2)}`, 20, yPosition + 30);
    doc.text(`Balance: Bs. ${(totalIngresos - totalEgresos).toFixed(2)}`, 20, yPosition + 40);

    // Guardar el PDF
    doc.save(`reporte_cajas_completo_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportarExcel = () => {
    const { cajasAExportar, movimientosFiltrados } = obtenerDatosExportacion();

    // Crear el workbook
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Resumen de Cajas
    const cajasData = [
      ['REPORTE COMPLETO DE CAJAS - GIMNASIO'],
      [`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`],
      [''],
      ['ID', 'Descripción', 'Fecha Apertura', 'Saldo Inicial', 'Saldo Actual', 'Estado'],
      ...cajasAExportar.map(caja => [
        caja.id_caja,
        caja.descripcion || 'Sin descripción',
        formatDate(caja.fecha_apertura),
        parseFloat(caja.saldo_inicial) || 0,
        parseFloat(caja.saldo_actual) || 0,
        caja.abierta ? 'Abierta' : 'Cerrada'
      ])
    ];

    const worksheetCajas = XLSX.utils.aoa_to_sheet(cajasData);
    XLSX.utils.book_append_sheet(workbook, worksheetCajas, 'Cajas');

    // Hoja 2: Movimientos (si está habilitado)
    if (incluirMovimientos && movimientosFiltrados.length > 0) {
      const movimientosData = [
        ['HISTORIAL DE MOVIMIENTOS'],
        [''],
        ['ID', 'Caja', 'Administrador', 'Tipo', 'Origen', 'Descripción', 'Monto', 'Fecha'],
        ...movimientosFiltrados.map(mov => {
          const caja = cajasArray.find(c => c.id_caja === mov.id_caja);
          const admin = administrativos.find(a => a.id_admin === mov.id_admin);
          
          return [
            mov.id_movimiento,
            caja?.descripcion || `Caja ${mov.id_caja}`,
            `${admin?.nombre || 'N/A'} ${admin?.apellido || ''}`.trim(),
            mov.tipo_movimiento,
            mov.origen || 'N/A',
            mov.descripcion || 'Sin descripción',
            parseFloat(mov.monto) || 0,
            formatDate(mov.fecha_movimiento)
          ];
        })
      ];

      const worksheetMovimientos = XLSX.utils.aoa_to_sheet(movimientosData);
      XLSX.utils.book_append_sheet(workbook, worksheetMovimientos, 'Movimientos');
    }

    // Hoja 3: Resumen Financiero
    const totalSaldoInicial = cajasAExportar.reduce((sum, caja) => sum + (parseFloat(caja.saldo_inicial) || 0), 0);
    const totalSaldoActual = cajasAExportar.reduce((sum, caja) => sum + (parseFloat(caja.saldo_actual) || 0), 0);
    const totalIngresos = movimientosFiltrados
      .filter(mov => mov.tipo_movimiento === 'Ingreso')
      .reduce((sum, mov) => sum + (parseFloat(mov.monto) || 0), 0);
    const totalEgresos = movimientosFiltrados
      .filter(mov => mov.tipo_movimiento === 'Egreso')
      .reduce((sum, mov) => sum + (parseFloat(mov.monto) || 0), 0);

    const resumenData = [
      ['RESUMEN FINANCIERO'],
      [''],
      ['Concepto', 'Monto (Bs.)'],
      ['Total Saldo Inicial', totalSaldoInicial],
      ['Total Saldo Actual', totalSaldoActual],
      ['Total Ingresos', totalIngresos],
      ['Total Egresos', totalEgresos],
      ['Balance', totalIngresos - totalEgresos],
      [''],
      ['Estadísticas'],
      ['Total de Cajas', cajasAExportar.length],
      ['Cajas Abiertas', cajasAExportar.filter(c => c.abierta).length],
      ['Cajas Cerradas', cajasAExportar.filter(c => !c.abierta).length],
      ['Total Movimientos', movimientosFiltrados.length]
    ];

    const worksheetResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, worksheetResumen, 'Resumen');

    // Guardar el archivo
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `reporte_cajas_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const ejecutarExportacion = () => {
    if (tipoExportacion === 'pdf') {
      exportarPDF();
    } else {
      exportarExcel();
    }
    setShowExportModal(false);
  };

  // Funciones para manejo de selección de cajas
  const toggleCajaSeleccion = (cajaId) => {
    setCajasSeleccionadas(prev => 
      prev.includes(cajaId) 
        ? prev.filter(id => id !== cajaId)
        : [...prev, cajaId]
    );
  };

  const seleccionarTodasLasCajas = () => {
    setCajasSeleccionadas(cajasArray.map(caja => caja.id_caja));
  };

  const limpiarSeleccion = () => {
    setCajasSeleccionadas([]);
  };

  const totalSaldo = cajasArray.reduce((sum, caja) => sum + (parseFloat(caja.saldo_actual) || 0), 0);
  const cajasAbiertas = cajasArray.filter(caja => caja.abierta).length;

  // Funciones para movimientos de caja
  const openMovimientoModal = (caja) => {
    setSelectedCaja(caja);
    setMovimientoFormData({
      id_caja: caja.id_caja,
      id_admin: '1',
      tipo_movimiento: 'Ingreso',
      descripcion: '',
      monto: '',
      origen: 'Otro'
    });
    setShowMovimientoModal(true);
  };

  const openMovimientosModal = (caja) => {
    setSelectedCaja(caja);
    // Limpiar filtros al abrir el modal
    limpiarFiltrosHistorial();
    setShowMovimientosModal(true);
  };

  const handleMovimientoSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/movimientos-caja', movimientoFormData);
      await fetchCajas(); // Actualizar saldos
      await fetchMovimientos(); // Actualizar movimientos
      setShowMovimientoModal(false);
      
      // Mostrar check de éxito
      setShowSuccessCheck(true);
      setTimeout(() => setShowSuccessCheck(false), 3000);
      
    } catch (error) {
      console.error('Error al crear movimiento:', error);
      alert('Error al registrar el movimiento');
    }
  };

  const getMovimientosByCaja = (idCaja) => {
    let movimientosFiltrados = movimientos.filter(mov => mov.id_caja === idCaja);

    // Aplicar filtros del historial
    if (historialSearch) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        mov.descripcion?.toLowerCase().includes(historialSearch.toLowerCase()) ||
        mov.origen?.toLowerCase().includes(historialSearch.toLowerCase()) ||
        mov.Administrativo?.nombre?.toLowerCase().includes(historialSearch.toLowerCase())
      );
    }

    if (historialFechaInicio) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        new Date(mov.fecha_movimiento) >= new Date(historialFechaInicio)
      );
    }

    if (historialFechaFin) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        new Date(mov.fecha_movimiento) <= new Date(historialFechaFin)
      );
    }

    if (historialAdminFilter) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        mov.Administrativo?.nombre?.toLowerCase().includes(historialAdminFilter.toLowerCase())
      );
    }

    if (historialTipoFilter) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        mov.tipo_movimiento === historialTipoFilter
      );
    }

    if (historialOrigenFilter) {
      movimientosFiltrados = movimientosFiltrados.filter(mov => 
        mov.origen === historialOrigenFilter
      );
    }

    return movimientosFiltrados.sort((a, b) => new Date(b.fecha_movimiento) - new Date(a.fecha_movimiento));
  };

  // Función para limpiar filtros del historial
  const limpiarFiltrosHistorial = () => {
    setHistorialSearch('');
    setHistorialFechaInicio('');
    setHistorialFechaFin('');
    setHistorialAdminFilter('');
    setHistorialTipoFilter('');
    setHistorialOrigenFilter('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-purple-300">Cargando cajas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container h-full flex flex-col relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Control de Cajas</h2>
          <p className="text-purple-300">Administra las cajas registradoras del gimnasio</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            � CSV Rápido
          </Button>
          <Button onClick={() => setShowExportModal(true)} variant="outline" size="sm">
            �📊 Exportar Completo
          </Button>
          <Button onClick={() => setShowModal(true)} size="sm">
            ➕ Nueva Caja
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar cajas por descripción..."
          />
        </div>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{cajasArray.length}</div>
          <div className="text-sm text-purple-300">Total Cajas</div>
          <div className="text-xs text-green-400">{cajasAbiertas} abiertas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            Bs. {formatPrice(totalSaldo)}
          </div>
          <div className="text-sm text-purple-300">Saldo Total</div>
        </Card>
      </div>

      {/* Cajas Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/30">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Fecha Apertura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Saldo Inicial
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Saldo Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-700/30">
              {paginatedItems.map((caja) => (
                <tr key={caja.id_caja} className="hover:bg-purple-900/20 transition-colors">
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-purple-300">
                    #{caja.id_caja}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {caja.descripcion}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-purple-200">
                    {formatFecha(caja.fecha_apertura)}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-400">
                      Bs. {formatPrice(caja.saldo_inicial)}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-400">
                      Bs. {formatPrice(caja.saldo_actual)}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <Badge 
                      variant={caja.abierta ? 'success' : 'secondary'}
                      className={caja.abierta ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}
                    >
                      {caja.abierta ? '🟢 Abierta' : '🔴 Cerrada'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(caja)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                        title="Editar caja"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openMovimientoModal(caja)}
                        className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                        title="Nuevo movimiento"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openMovimientosModal(caja)}
                        className="p-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 rounded transition-colors"
                        title="Ver historial"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleEstado(caja)}
                        className={`p-2 rounded transition-colors ${
                          caja.abierta 
                            ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-400/10' 
                            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10'
                        }`}
                        title={caja.abierta ? 'Cerrar caja' : 'Abrir caja'}
                      >
                        {caja.abierta ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(caja)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                        title="Eliminar caja"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-purple-300 mb-4">
              💳 No se encontraron cajas
            </div>
            <Button onClick={() => setShowModal(true)} size="sm">
              Crear primera caja
            </Button>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          onFirstPage={() => goToPage(1)}
          onLastPage={() => goToPage(totalPages)}
          onPreviousPage={goToPreviousPage}
          onNextPage={goToNextPage}
        />
      )}

      {/* Modal de Formulario */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCaja ? 'Editar Caja' : 'Agregar Caja'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <input
                    type="text"
                    value={formData.descripcion}
                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                    className="form-input"
                    placeholder="Nombre de la caja"
                    required
                  />
                </div>

                {!editingCaja && (
                  <div className="form-group">
                    <label className="form-label">Saldo Inicial (Bs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.saldo_inicial}
                      onChange={(e) => handleInputChange('saldo_inicial', e.target.value)}
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.abierta}
                      onChange={(e) => handleInputChange('abierta', e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-gray-800 border-purple-600 rounded"
                    />
                    <span className="form-label mb-0">Caja abierta (operativa)</span>
                  </label>
                </div>

                {editingCaja && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-300 mb-2">Información de la Caja</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-purple-300">ID:</span>
                        <span className="text-white ml-2">#{editingCaja.id_caja}</span>
                      </div>
                      <div>
                        <span className="text-purple-300">Saldo Inicial:</span>
                        <span className="text-white ml-2">Bs. {formatPrice(editingCaja.saldo_inicial)}</span>
                      </div>
                      <div>
                        <span className="text-purple-300">Saldo Actual:</span>
                        <span className="text-green-400 ml-2">Bs. {formatPrice(editingCaja.saldo_actual)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Guardando...' : (editingCaja ? 'Actualizar' : 'Guardar')}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {showMovimientoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Nuevo Movimiento - {selectedCaja?.descripcion}</h3>
              <button onClick={() => setShowMovimientoModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleMovimientoSubmit}>
                <div className="form-group">
                  <label className="text-gray-200 font-medium">Tipo de Movimiento</label>
                  <select
                    value={movimientoFormData.tipo_movimiento}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      tipo_movimiento: e.target.value
                    })}
                    className="form-input bg-gray-800 border-gray-600 text-white"
                    required
                  >
                    <option value="Ingreso" className="bg-gray-800 text-green-300">💰 Ingreso</option>
                    <option value="Egreso" className="bg-gray-800 text-red-300">💸 Egreso</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-gray-200 font-medium">Origen</label>
                  <select
                    value={movimientoFormData.origen}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      origen: e.target.value
                    })}
                    className="form-input bg-gray-800 border-gray-600 text-white"
                    required
                  >
                    <option value="Venta" className="bg-gray-800 text-blue-300">🛒 Venta</option>
                    <option value="Pago" className="bg-gray-800 text-green-300">💳 Pago</option>
                    <option value="Otro" className="bg-gray-800 text-gray-300">📋 Otro</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-gray-200 font-medium">Monto (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={movimientoFormData.monto}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      monto: e.target.value
                    })}
                    className="form-input bg-gray-800 border-gray-600 text-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="text-gray-200 font-medium">Descripción</label>
                  <textarea
                    value={movimientoFormData.descripcion}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      descripcion: e.target.value
                    })}
                    className="form-input bg-gray-800 border-gray-600 text-white"
                    placeholder="Describe el motivo del movimiento..."
                    rows="3"
                    required
                  ></textarea>
                </div>

                <div className="modal-actions">
                  <button type="submit" className="btn-primary">
                    💰 Registrar Movimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMovimientoModal(false)}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Movimientos */}
      {showMovimientosModal && selectedCaja && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>📋 Historial de Movimientos - {selectedCaja.descripcion}</h3>
              <button onClick={() => setShowMovimientosModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mb-4 p-4 bg-gray-800/60 rounded-lg border border-gray-600/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-medium">💰 Saldo Inicial:</span>
                    <span className="text-blue-400 font-bold">Bs. {formatPrice(selectedCaja.saldo_inicial)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-medium">💵 Saldo Actual:</span>
                    <span className="text-green-400 font-bold text-lg">Bs. {formatPrice(selectedCaja.saldo_actual)}</span>
                  </div>
                </div>
              </div>

              {/* Filtros del Historial */}
              <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-purple-700/30">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-cyan-300 font-semibold text-lg">🔍 Filtros y Búsqueda</h4>
                  <button
                    onClick={limpiarFiltrosHistorial}
                    className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors font-medium"
                  >
                    🗑️ Limpiar
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {/* Buscador general */}
                  <div className="md:col-span-3">
                    <label className="block text-purple-300 mb-1">Buscar en descripción o admin:</label>
                    <input
                      type="text"
                      value={historialSearch}
                      onChange={(e) => setHistorialSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
                    />
                  </div>

                  {/* Filtro por fechas */}
                  <div>
                    <label className="block text-purple-300 mb-1">Desde:</label>
                    <input
                      type="date"
                      value={historialFechaInicio}
                      onChange={(e) => setHistorialFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-purple-300 mb-1">Hasta:</label>
                    <input
                      type="date"
                      value={historialFechaFin}
                      onChange={(e) => setHistorialFechaFin(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
                    />
                  </div>

                  {/* Filtro por administrador */}
                  <div>
                    <label className="block text-purple-300 mb-1">Administrador:</label>
                    <select
                      value={historialAdminFilter}
                      onChange={(e) => setHistorialAdminFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
                    >
                      <option value="">Todos</option>
                      {administrativos.map(admin => (
                        <option key={admin.id_admin} value={admin.nombre}>
                          {admin.nombre} {admin.apellido}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por tipo */}
                  <div>
                    <label className="block text-purple-300 mb-1">Tipo:</label>
                    <select
                      value={historialTipoFilter}
                      onChange={(e) => setHistorialTipoFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
                    >
                      <option value="">Todos</option>
                      <option value="Ingreso">💰 Ingreso</option>
                      <option value="Egreso">💸 Egreso</option>
                    </select>
                  </div>

                  {/* Filtro por origen */}
                  <div>
                    <label className="block text-purple-300 mb-1">Origen:</label>
                    <select
                      value={historialOrigenFilter}
                      onChange={(e) => setHistorialOrigenFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
                    >
                      <option value="">Todos</option>
                      <option value="Pago">Pago</option>
                      <option value="Venta">Venta</option>
                      <option value="Desembolso">Desembolso</option>
                      <option value="Reembolso">Reembolso</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                {/* Contador de resultados */}
                <div className="mt-3 px-3 py-2 bg-blue-900/30 rounded-lg border border-blue-600/30">
                  <span className="text-blue-300 text-sm font-medium">
                    📊 Mostrando {getMovimientosByCaja(selectedCaja.id_caja).length} movimiento(s)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold border-b border-gray-600">Fecha</th>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold border-b border-gray-600">Tipo</th>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold border-b border-gray-600">Origen</th>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold border-b border-gray-600">Descripción</th>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold border-b border-gray-600">Monto</th>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold border-b border-gray-600">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600/50 bg-gray-900/50">
                    {getMovimientosByCaja(selectedCaja.id_caja).map((mov) => (
                      <tr key={mov.id_movimiento} className="hover:bg-gray-800/60 transition-colors">
                        <td className="px-4 py-3 text-gray-300 font-medium">
                          {formatFecha(mov.fecha_movimiento)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold px-2 py-1 rounded-md ${
                            mov.tipo_movimiento === 'Ingreso' 
                              ? 'text-green-100 bg-green-700/80' 
                              : 'text-red-100 bg-red-700/80'
                          }`}>
                            {mov.tipo_movimiento === 'Ingreso' ? '💰' : '💸'} {mov.tipo_movimiento}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-blue-300 font-medium">{mov.origen}</td>
                        <td className="px-4 py-3 text-gray-100">{mov.descripcion}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold text-lg ${
                            mov.tipo_movimiento === 'Ingreso' 
                              ? 'text-green-400' 
                              : 'text-red-400'
                          }`}>
                            {mov.tipo_movimiento === 'Ingreso' ? '+' : '-'}Bs. {formatPrice(mov.monto)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-cyan-300 font-medium">
                          {mov.Administrativo?.nombre || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {getMovimientosByCaja(selectedCaja.id_caja).length === 0 && (
                  <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-600/50">
                    <div className="text-6xl mb-4 opacity-50">📄</div>
                    <p className="text-gray-300 text-lg font-medium">No hay movimientos registrados para esta caja</p>
                    <p className="text-gray-400 text-sm mt-2">Los movimientos aparecerán aquí cuando se registren</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowMovimientosModal(false)}
                  className="btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportación Avanzada */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Exportación Completa de Cajas</h3>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              {/* Tipo de exportación */}
              <div className="form-group">
                <label className="form-label">Formato de Exportación</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="pdf"
                      checked={tipoExportacion === 'pdf'}
                      onChange={(e) => setTipoExportacion(e.target.value)}
                      className="mr-2"
                    />
                    📄 PDF
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="excel"
                      checked={tipoExportacion === 'excel'}
                      onChange={(e) => setTipoExportacion(e.target.value)}
                      className="mr-2"
                    />
                    📊 Excel
                  </label>
                </div>
              </div>

              {/* Incluir movimientos */}
              <div className="form-group">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={incluirMovimientos}
                    onChange={(e) => setIncluirMovimientos(e.target.checked)}
                    className="mr-2"
                  />
                  Incluir historial de movimientos detallado
                </label>
              </div>

              {/* Filtro de fechas */}
              <div className="form-group">
                <label className="form-label">Filtro de Fechas</label>
                <select
                  value={filtroFechaExport}
                  onChange={(e) => setFiltroFechaExport(e.target.value)}
                  className="form-input"
                >
                  <option value="todos">Todos los datos</option>
                  <option value="semana">Última semana</option>
                  <option value="mes">Último mes</option>
                  <option value="trimestre">Último trimestre</option>
                  <option value="personalizado">Rango personalizado</option>
                </select>
              </div>

              {/* Rango personalizado */}
              {filtroFechaExport === 'personalizado' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Fecha Inicio</label>
                    <input
                      type="date"
                      value={fechaInicioExport}
                      onChange={(e) => setFechaInicioExport(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha Fin</label>
                    <input
                      type="date"
                      value={fechaFinExport}
                      onChange={(e) => setFechaFinExport(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              {/* Selección de cajas */}
              <div className="form-group">
                <label className="form-label">Cajas a Exportar</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={seleccionarTodasLasCajas}
                    className="btn-secondary btn-sm"
                  >
                    Seleccionar Todas
                  </button>
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    className="btn-secondary btn-sm"
                  >
                    Limpiar Selección
                  </button>
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-gray-600 rounded p-3 bg-gray-800/50">
                  {cajasArray.map(caja => (
                    <label key={caja.id_caja} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={cajasSeleccionadas.includes(caja.id_caja)}
                        onChange={() => toggleCajaSeleccion(caja.id_caja)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {caja.descripcion || `Caja ${caja.id_caja}`} 
                        <span className="text-gray-400">
                          (Saldo: Bs. {formatPrice(caja.saldo_actual)})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                
                <div className="text-sm text-gray-400 mt-2">
                  {cajasSeleccionadas.length === 0 
                    ? "Se exportarán todas las cajas" 
                    : `${cajasSeleccionadas.length} caja(s) seleccionada(s)`
                  }
                </div>
              </div>

              {/* Resumen de exportación */}
              <div className="bg-gray-800/50 p-4 rounded border border-gray-600">
                <h4 className="text-lg font-medium mb-2">📋 Resumen de Exportación</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Formato: {tipoExportacion.toUpperCase()}</li>
                  <li>• Cajas: {cajasSeleccionadas.length || cajasArray.length}</li>
                  <li>• Movimientos: {incluirMovimientos ? 'Incluidos' : 'No incluidos'}</li>
                  <li>• Período: {
                    filtroFechaExport === 'todos' ? 'Todos los datos' :
                    filtroFechaExport === 'personalizado' ? 
                      `${fechaInicioExport} - ${fechaFinExport}` :
                      filtroFechaExport
                  }</li>
                </ul>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowExportModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarExportacion}
                className="btn-primary"
              >
                {tipoExportacion === 'pdf' ? '📄' : '📊'} Exportar {tipoExportacion.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check de éxito */}
      {showSuccessCheck && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          ✅ Movimiento registrado exitosamente
        </div>
      )}
    </div>
  );
}