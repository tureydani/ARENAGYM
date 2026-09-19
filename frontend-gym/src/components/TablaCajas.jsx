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
import { IconDocumentDownload, IconArchiveBox, IconCheckCircle } from './ui/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { formatearFecha, parsearFechaLocal } from '../utils/fechas';
import { CANALES_COBRO, CANAL_EFECTIVO } from '../constants/canalesCobro';
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

  // Filtros del historial de JORNADAS (tabla principal, no el modal de
  // movimientos de una jornada -- ese tiene sus propios filtros más abajo)
  const [jornadaEstadoFilter, setJornadaEstadoFilter] = useState('');
  const [jornadaResponsableFilter, setJornadaResponsableFilter] = useState('');
  const [jornadaCanalFilter, setJornadaCanalFilter] = useState('');
  const [jornadaDiferenciaFilter, setJornadaDiferenciaFilter] = useState('');

  // Estados para filtros del historial
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialFechaInicio, setHistorialFechaInicio] = useState('');
  const [historialFechaFin, setHistorialFechaFin] = useState('');
  const [historialAdminFilter, setHistorialAdminFilter] = useState('');
  const [historialTipoFilter, setHistorialTipoFilter] = useState('');
  const [historialOrigenFilter, setHistorialOrigenFilter] = useState('');
  const [historialCanalFilter, setHistorialCanalFilter] = useState('');
  
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

  // Apertura formal de caja (POST /cajas/abrir): crea una fila nueva, no
  // togglea una existente. Se usa tanto para abrir una caja nueva como
  // para reabrir una ya cerrada (precargando su descripción).
  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [aperturaFormData, setAperturaFormData] = useState({ descripcion: '', saldo_inicial: '' });

  // Cierre formal con arqueo (GET .../arqueo + POST .../cerrar).
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cierreData, setCierreData] = useState(null);
  const [cierreLoading, setCierreLoading] = useState(false);
  const [saldoContado, setSaldoContado] = useState('');

  const [movimientoFormData, setMovimientoFormData] = useState({
    id_caja: '',
    id_admin: '1', // Por defecto
    tipo_movimiento: 'Ingreso',
    descripcion: '',
    monto: '',
    origen: 'Otro',
    canal_cobro: CANAL_EFECTIVO
  });

  // Configuración de paginación
  const itemsPerPage = 8;
  
  // Asegurar que cajas sea siempre un array
  const cajasArray = Array.isArray(cajas) ? cajas : [];

  const cajasFiltradas = cajasArray.filter(caja => {
    if (!caja.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (jornadaEstadoFilter && caja.estado !== jornadaEstadoFilter) return false;
    if (jornadaResponsableFilter) {
      const responsable = `${caja.AdminApertura?.nombre || ''} ${caja.AdminApertura?.apellido || ''}`.toLowerCase();
      if (!responsable.includes(jornadaResponsableFilter.toLowerCase())) return false;
    }
    if (jornadaCanalFilter) {
      const tieneCanal = movimientos.some(m => m.id_caja === caja.id_caja && m.canal_cobro === jornadaCanalFilter);
      if (!tieneCanal) return false;
    }
    if (jornadaDiferenciaFilter === 'con_diferencia' && Math.round((parseFloat(caja.diferencia) || 0) * 100) === 0) return false;
    if (jornadaDiferenciaFilter === 'cuadradas' && caja.estado === 'CERRADA' && Math.round((parseFloat(caja.diferencia) || 0) * 100) !== 0) return false;
    return true;
  });

  const {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    nextPage: goToNextPage,
    prevPage: goToPreviousPage
  } = usePagination(cajasFiltradas, itemsPerPage);

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

  // Este modal ahora solo EDITA la descripción de una caja existente
  // (abierta): abrir/cerrar pasó a los flujos dedicados de abajo, que
  // exigen arqueo/responsable en vez de togglear un booleano a ciegas.
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.descripcion.trim()) {
      alert('Por favor, ingrese una descripción para la caja');
      return;
    }

    try {
      await api.put(`/cajas/${editingCaja.id_caja}`, {
        descripcion: formData.descripcion.trim()
      });
      await fetchCajas();
      closeModal();
    } catch (error) {
      console.error('Error al guardar caja:', error);
      alert(error.response?.data?.error || 'Error al guardar la caja');
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

  const getAdminActualId = () => {
    const adminData = sessionStorage.getItem('admin');
    const admin = adminData ? JSON.parse(adminData) : null;
    return admin?.id_admin;
  };

  // Apertura formal: crea una caja NUEVA con estado ABIERTA (no reutiliza
  // la fila de una caja cerrada). Si se pasa `caja`, se precarga su
  // descripción para "reabrir" el mismo canal (ej. volver a abrir
  // "Efectivo" al día siguiente).
  const openAperturaModal = (caja = null) => {
    setAperturaFormData({ descripcion: caja?.descripcion || '', saldo_inicial: '' });
    setShowAperturaModal(true);
  };

  const closeAperturaModal = () => {
    setShowAperturaModal(false);
    setAperturaFormData({ descripcion: '', saldo_inicial: '' });
  };

  const handleAperturaSubmit = async (e) => {
    e.preventDefault();

    if (!aperturaFormData.descripcion.trim()) {
      alert('Por favor, ingrese una descripción para la caja');
      return;
    }
    const id_admin = getAdminActualId();
    if (!id_admin) {
      alert('No se pudo identificar al administrador actual. Vuelve a iniciar sesión.');
      return;
    }

    try {
      await api.post('/cajas/abrir', {
        descripcion: aperturaFormData.descripcion.trim(),
        saldo_inicial: parseFloat(aperturaFormData.saldo_inicial) || 0,
        id_admin
      });
      await fetchCajas();
      closeAperturaModal();
    } catch (error) {
      console.error('Error al abrir caja:', error);
      alert(error.response?.data?.error || 'Error al abrir la caja');
    }
  };

  // Cierre formal con arqueo: primero trae el saldo esperado calculado por
  // el backend (a partir de movimientos_caja), luego el responsable
  // introduce el dinero contado y confirma.
  const openCierreModal = async (caja) => {
    setSelectedCaja(caja);
    setSaldoContado('');
    setCierreData(null);
    setShowCierreModal(true);
    setCierreLoading(true);
    try {
      const response = await api.get(`/cajas/${caja.id_caja}/arqueo`);
      setCierreData(response.data);
    } catch (error) {
      console.error('Error al calcular arqueo:', error);
      alert(error.response?.data?.error || 'Error al calcular el arqueo de la caja');
      setShowCierreModal(false);
    } finally {
      setCierreLoading(false);
    }
  };

  const closeCierreModal = () => {
    setShowCierreModal(false);
    setSelectedCaja(null);
    setCierreData(null);
    setSaldoContado('');
  };

  const handleConfirmarCierre = async () => {
    const id_admin = getAdminActualId();
    if (!id_admin) {
      alert('No se pudo identificar al administrador actual. Vuelve a iniciar sesión.');
      return;
    }
    const contado = parseFloat(saldoContado);
    if (saldoContado === '' || Number.isNaN(contado) || contado < 0) {
      alert('Ingresa el dinero contado (un número mayor o igual a 0).');
      return;
    }
    if (!window.confirm(`¿Confirmar el cierre de "${selectedCaja.descripcion}"? Esta acción no se puede deshacer.`)) return;

    try {
      const response = await api.post(`/cajas/${selectedCaja.id_caja}/cerrar`, {
        saldo_contado: contado,
        id_admin
      });
      await fetchCajas();
      closeCierreModal();
      alert(response.data.message);
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      alert(error.response?.data?.error || 'Error al cerrar la caja');
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

  const formatFecha = (fecha) => formatearFecha(fecha, { year: 'numeric', month: '2-digit', day: '2-digit' });

  // Tipo de operación derivado de `origen` (no existe columna propia, ver
  // diseño acordado): Pago -> Membresía, Venta -> Producto.
  const operacionDeOrigen = (origen) => ({
    Pago: 'Membresía', Venta: 'Producto', Desembolso: 'Egreso', Reembolso: 'Reversión', Otro: 'Otros'
  }[origen] || origen || 'N/A');

  const exportToCSV = () => {
    const headers = ['Jornada', 'Punto de cobro', 'Apertura', 'Responsable', 'Saldo Inicial', 'Saldo Registrado', 'Efectivo Esperado', 'Efectivo Contado', 'Diferencia', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...cajasArray.map(caja => [
        caja.id_caja,
        `"${caja.descripcion || ''}"`,
        caja.fecha_apertura || '',
        `"${caja.AdminApertura ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}` : ''}"`,
        formatPrice(caja.saldo_inicial),
        formatPrice(caja.saldo_actual),
        caja.estado === 'CERRADA' ? formatPrice(caja.saldo_esperado) : formatPrice(getEfectivoEsperado(caja)),
        caja.saldo_contado !== null && caja.saldo_contado !== undefined ? formatPrice(caja.saldo_contado) : '',
        caja.diferencia !== null && caja.diferencia !== undefined ? formatPrice(caja.diferencia) : '',
        caja.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `jornadas_${new Date().toISOString().split('T')[0]}.csv`;
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
            fechaInicio = parsearFechaLocal(fechaInicioExport);
            const fechaFin = parsearFechaLocal(fechaFinExport);
            movimientosFiltrados = movimientosFiltrados.filter(mov => {
              const fechaMov = parsearFechaLocal(mov.fecha_movimiento);
              return fechaMov >= fechaInicio && fechaMov <= fechaFin;
            });
          }
          break;
        default:
          break;
      }

      if (fechaInicio && filtroFechaExport !== 'personalizado') {
        movimientosFiltrados = movimientosFiltrados.filter(mov => {
          const fechaMov = parsearFechaLocal(mov.fecha_movimiento);
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
    doc.text('Reporte Completo de Jornadas - Gimnasio', 20, 20);

    doc.setFontSize(12);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 20, 35);
    doc.text(`Total de jornadas: ${cajasAExportar.length}`, 20, 45);

    let yPosition = 60;

    // Tabla de resumen de jornadas
    const cajasData = cajasAExportar.map(caja => [
      caja.id_caja,
      caja.descripcion || 'Sin descripción',
      formatFecha(caja.fecha_apertura),
      caja.AdminApertura ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}` : 'N/A',
      `Bs. ${formatPrice(caja.saldo_inicial)}`,
      `Bs. ${formatPrice(caja.saldo_actual)}`,
      caja.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'
    ]);

    autoTable(doc, {
      head: [['Jornada', 'Punto de cobro', 'Apertura', 'Responsable', 'Saldo Inicial', 'Saldo Registrado', 'Estado']],
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
          caja?.descripcion || `Jornada ${mov.id_caja}`,
          `${admin?.nombre || 'N/A'} ${admin?.apellido || ''}`.trim(),
          mov.tipo_movimiento,
          operacionDeOrigen(mov.origen),
          mov.canal_cobro || 'N/A',
          mov.descripcion || 'Sin descripción',
          `Bs. ${formatPrice(mov.monto)}`,
          formatFecha(mov.fecha_movimiento)
        ];
      });

      autoTable(doc, {
        head: [['ID', 'Jornada', 'Responsable', 'Tipo', 'Operación', 'Canal', 'Descripción', 'Monto', 'Fecha']],
        body: movimientosData,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
        columnStyles: {
          6: { cellWidth: 30 }, // Descripción
          7: { halign: 'right' }, // Monto
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
    doc.save(`reporte_jornadas_completo_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportarExcel = () => {
    const { cajasAExportar, movimientosFiltrados } = obtenerDatosExportacion();

    // Crear el workbook
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Resumen de Jornadas
    const cajasData = [
      ['REPORTE COMPLETO DE JORNADAS - GIMNASIO'],
      [`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`],
      [''],
      ['Jornada', 'Punto de cobro', 'Apertura', 'Responsable', 'Saldo Inicial', 'Saldo Registrado', 'Efectivo Esperado', 'Efectivo Contado', 'Diferencia', 'Estado'],
      ...cajasAExportar.map(caja => [
        caja.id_caja,
        caja.descripcion || 'Sin descripción',
        formatFecha(caja.fecha_apertura),
        caja.AdminApertura ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}` : 'N/A',
        parseFloat(caja.saldo_inicial) || 0,
        parseFloat(caja.saldo_actual) || 0,
        caja.estado === 'CERRADA' ? (parseFloat(caja.saldo_esperado) || 0) : getEfectivoEsperado(caja),
        caja.saldo_contado !== null && caja.saldo_contado !== undefined ? parseFloat(caja.saldo_contado) : '',
        caja.diferencia !== null && caja.diferencia !== undefined ? parseFloat(caja.diferencia) : '',
        caja.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'
      ])
    ];

    const worksheetCajas = XLSX.utils.aoa_to_sheet(cajasData);
    XLSX.utils.book_append_sheet(workbook, worksheetCajas, 'Jornadas');

    // Hoja 2: Movimientos (si está habilitado)
    if (incluirMovimientos && movimientosFiltrados.length > 0) {
      const movimientosData = [
        ['HISTORIAL DE MOVIMIENTOS'],
        [''],
        ['ID', 'Jornada', 'Responsable', 'Tipo', 'Operación', 'Canal', 'Descripción', 'Monto', 'Fecha'],
        ...movimientosFiltrados.map(mov => {
          const caja = cajasArray.find(c => c.id_caja === mov.id_caja);
          const admin = administrativos.find(a => a.id_admin === mov.id_admin);

          return [
            mov.id_movimiento,
            caja?.descripcion || `Jornada ${mov.id_caja}`,
            `${admin?.nombre || 'N/A'} ${admin?.apellido || ''}`.trim(),
            mov.tipo_movimiento,
            operacionDeOrigen(mov.origen),
            mov.canal_cobro || 'N/A',
            mov.descripcion || 'Sin descripción',
            parseFloat(mov.monto) || 0,
            formatFecha(mov.fecha_movimiento)
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
  const cajasAbiertasArray = cajasArray.filter(caja => caja.abierta);
  const totalIngresos = movimientos.filter(m => m.tipo_movimiento === 'Ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const totalEgresos = movimientos.filter(m => m.tipo_movimiento === 'Egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const diferenciasPendientes = cajasArray.filter(c => c.estado === 'CERRADA' && Math.round((parseFloat(c.diferencia) || 0) * 100) !== 0).length;

  // Desglose por canal de UNA jornada, calculado en el cliente a partir de
  // `movimientos` (ya cargado): ingresos - egresos de cada canal. No pega
  // a /arqueo para no golpear el backend por cada jornada abierta que se
  // muestra en pantalla.
  const getDesglosePorCanal = (idCaja) => {
    const desglose = {};
    for (const canal of CANALES_COBRO) {
      const ingresos = movimientos
        .filter(m => m.id_caja === idCaja && m.canal_cobro === canal.codigo && m.tipo_movimiento === 'Ingreso')
        .reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
      const egresos = movimientos
        .filter(m => m.id_caja === idCaja && m.canal_cobro === canal.codigo && m.tipo_movimiento === 'Egreso')
        .reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
      desglose[canal.codigo] = ingresos - egresos;
    }
    return desglose;
  };

  const getEfectivoEsperado = (caja) => {
    const desglose = getDesglosePorCanal(caja.id_caja);
    return (parseFloat(caja.saldo_inicial) || 0) + (desglose[CANAL_EFECTIVO] || 0);
  };

  // Funciones para movimientos de caja
  const openMovimientoModal = (caja) => {
    setSelectedCaja(caja);
    const adminData = sessionStorage.getItem('admin');
    const admin = adminData ? JSON.parse(adminData) : null;
    setMovimientoFormData({
      id_caja: caja.id_caja,
      id_admin: admin?.id_admin || '1',
      tipo_movimiento: 'Ingreso',
      descripcion: '',
      monto: '',
      origen: 'Otro',
      canal_cobro: CANAL_EFECTIVO
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

    // Aviso inmediato antes de llamar a la API: un Egreso no puede dejar la
    // caja en negativo. El backend es quien realmente lo bloquea (por si el
    // saldo cambió desde que se abrió el modal); esto es solo para no
    // hacerle esperar el viaje de ida y vuelta al servidor.
    if (movimientoFormData.tipo_movimiento === 'Egreso') {
      const saldoDisponible = parseFloat(selectedCaja?.saldo_actual) || 0;
      const montoSolicitado = parseFloat(movimientoFormData.monto) || 0;
      if (montoSolicitado > saldoDisponible) {
        alert(`Saldo insuficiente. Saldo disponible: Bs. ${saldoDisponible.toFixed(2)}, monto solicitado: Bs. ${montoSolicitado.toFixed(2)}`);
        return;
      }
    }

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
      alert(error.response?.data?.error || 'Error al registrar el movimiento');
    }
  };

  // Solo los movimientos manuales (sin id_referencia) se pueden eliminar
  // desde acá. Los que vienen de un pago o una venta (id_referencia
  // apunta a ese registro) hay que borrarlos desde su propia sección,
  // para no desincronizar el saldo de la caja con el pago/venta que
  // sigue activo.
  const puedeEliminarMovimiento = (mov) => mov.id_referencia === null || mov.id_referencia === undefined;

  const handleDeleteMovimiento = async (mov) => {
    if (!confirm(
      `¿Eliminar este movimiento?\n\n${mov.tipo_movimiento} de Bs. ${formatPrice(mov.monto)} - ${mov.descripcion || 'Sin descripción'}\n\n` +
      'Esto revertirá el monto en el saldo de la caja.'
    )) return;

    try {
      const response = await api.delete(`/movimientos-caja/${mov.id_movimiento}`);
      await fetchMovimientos();
      await fetchCajas();

      // Reflejar el saldo actualizado en el modal de historial, que sigue abierto
      if (response.data?.cajaAfectada && selectedCaja?.id_caja === response.data.cajaAfectada.id) {
        setSelectedCaja(prev => ({ ...prev, saldo_actual: response.data.cajaAfectada.saldoActual }));
      }
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      alert(error.response?.data?.error || 'Error al eliminar el movimiento');
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
        parsearFechaLocal(mov.fecha_movimiento) >= parsearFechaLocal(historialFechaInicio)
      );
    }

    if (historialFechaFin) {
      movimientosFiltrados = movimientosFiltrados.filter(mov =>
        parsearFechaLocal(mov.fecha_movimiento) <= parsearFechaLocal(historialFechaFin)
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

    if (historialCanalFilter) {
      movimientosFiltrados = movimientosFiltrados.filter(mov =>
        mov.canal_cobro === historialCanalFilter
      );
    }

    return movimientosFiltrados.sort((a, b) => parsearFechaLocal(b.fecha_movimiento) - parsearFechaLocal(a.fecha_movimiento));
  };

  // Función para limpiar filtros del historial
  const limpiarFiltrosHistorial = () => {
    setHistorialSearch('');
    setHistorialFechaInicio('');
    setHistorialFechaFin('');
    setHistorialAdminFilter('');
    setHistorialTipoFilter('');
    setHistorialOrigenFilter('');
    setHistorialCanalFilter('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-slate-500">Cargando cajas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container h-full flex flex-col relative">
      <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Control de Caja</h2>
          <p className="text-slate-500">Gestiona las jornadas, movimientos y canales de cobro del gimnasio</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <IconDocumentDownload className="w-4 h-4 inline-block mr-1" /> CSV Rápido
          </Button>
          <Button onClick={() => setShowExportModal(true)} variant="outline" size="sm">
            <IconDocumentDownload className="w-4 h-4 inline-block mr-1" /> Exportar Completo
          </Button>
          <Button onClick={() => openAperturaModal()} size="sm">
            + Nueva jornada
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{cajasAbiertas}</div>
          <div className="text-sm text-slate-500">Jornadas abiertas</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-700">
            Bs. {formatPrice(totalSaldo)}
          </div>
          <div className="text-sm text-slate-500">Saldo registrado</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">
            Bs. {formatPrice(totalIngresos)}
          </div>
          <div className="text-sm text-slate-500">Ingresos</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            Bs. {formatPrice(totalEgresos)}
          </div>
          <div className="text-sm text-slate-500">Egresos</div>
        </Card>
        <Card className="p-4 text-center">
          <div className={`text-2xl font-bold ${diferenciasPendientes > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
            {diferenciasPendientes}
          </div>
          <div className="text-sm text-slate-500">Diferencias pendientes</div>
        </Card>
      </div>

      {/* Jornada(s) activa(s): el elemento principal de la pantalla */}
      {cajasAbiertasArray.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-slate-900">Jornada activa</h3>
          <div className={`grid gap-4 ${cajasAbiertasArray.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {cajasAbiertasArray.map(caja => {
              const desglose = getDesglosePorCanal(caja.id_caja);
              const efectivoEsperado = getEfectivoEsperado(caja);
              return (
                <Card key={caja.id_caja} className="p-5 border-2 border-indigo-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{caja.descripcion}</div>
                      <div className="text-sm text-slate-500">Jornada #{caja.id_caja}</div>
                    </div>
                    <Badge variant="success" className="bg-emerald-50 text-emerald-700">Abierta</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mb-4 space-y-0.5">
                    <div>Responsable: {caja.AdminApertura ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}` : 'N/D'}</div>
                    <div>Apertura: {formatearFecha(caja.fecha_apertura, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Saldo registrado</div>
                      <div className="text-lg font-bold text-slate-800">Bs. {formatPrice(caja.saldo_actual)}</div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <div className="text-xs text-indigo-600">Efectivo esperado</div>
                      <div className="text-lg font-bold text-indigo-700">Bs. {formatPrice(efectivoEsperado)}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs font-semibold text-slate-500 mb-2">Canales de cobro</div>
                    <div className="space-y-1">
                      {CANALES_COBRO.map(canal => (
                        <div key={canal.codigo} className="flex justify-between text-sm">
                          <span className="text-slate-600">{canal.icono} {canal.nombre}</span>
                          <span className="font-medium text-slate-900">Bs. {formatPrice(desglose[canal.codigo])}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => openMovimientosModal(caja)} variant="outline" size="sm">Ver movimientos</Button>
                    <Button onClick={() => handleEdit(caja)} variant="outline" size="sm">Ver detalle</Button>
                    <Button onClick={() => openCierreModal(caja)} size="sm">Cerrar jornada</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Historial de jornadas */}
      <h3 className="text-lg font-semibold text-slate-900 -mb-2">Historial de jornadas</h3>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por punto de cobro..."
          />
        </div>
        <select
          value={jornadaEstadoFilter}
          onChange={(e) => setJornadaEstadoFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700"
        >
          <option value="">Todos los estados</option>
          <option value="ABIERTA">Abierta</option>
          <option value="CERRADA">Cerrada</option>
        </select>
        <input
          type="text"
          value={jornadaResponsableFilter}
          onChange={(e) => setJornadaResponsableFilter(e.target.value)}
          placeholder="Responsable..."
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700"
        />
        <select
          value={jornadaCanalFilter}
          onChange={(e) => setJornadaCanalFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700"
        >
          <option value="">Todos los canales</option>
          {CANALES_COBRO.map(canal => (
            <option key={canal.codigo} value={canal.codigo}>{canal.icono} {canal.nombre}</option>
          ))}
        </select>
        <select
          value={jornadaDiferenciaFilter}
          onChange={(e) => setJornadaDiferenciaFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700"
        >
          <option value="">Cualquier diferencia</option>
          <option value="con_diferencia">Con diferencia</option>
          <option value="cuadradas">Solo cuadradas</option>
        </select>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-indigo-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Punto de cobro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Apertura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Responsable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Saldo Inicial
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Saldo Registrado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Cierre / Diferencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedItems.map((caja) => (
                <tr key={caja.id_caja} className="hover:bg-indigo-50 transition-colors">
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-slate-500">
                    #{caja.id_caja}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">
                      {caja.descripcion}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-slate-600">
                    {formatearFecha(caja.fecha_apertura, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-slate-600">
                    {caja.AdminApertura ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}` : '—'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-indigo-600">
                      Bs. {formatPrice(caja.saldo_inicial)}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-emerald-600">
                      Bs. {formatPrice(caja.saldo_actual)}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <Badge
                      variant={caja.estado === 'ABIERTA' ? 'success' : 'secondary'}
                      className={caja.estado === 'ABIERTA' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}
                    >
                      {caja.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}
                    </Badge>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-xs">
                    {caja.estado === 'CERRADA' && caja.fecha_cierre ? (
                      <div>
                        <div className="text-slate-500">{formatearFecha(caja.fecha_cierre, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                        <div className={`font-semibold ${
                          parseFloat(caja.diferencia) === 0 ? 'text-emerald-600' :
                          parseFloat(caja.diferencia) > 0 ? 'text-sky-600' : 'text-red-600'
                        }`}>
                          {parseFloat(caja.diferencia) === 0
                            ? 'Cuadrada'
                            : `${parseFloat(caja.diferencia) > 0 ? 'Sobrante' : 'Faltante'}: Bs. ${Math.abs(parseFloat(caja.diferencia)).toFixed(2)}`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(caja)}
                        className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                        title="Editar caja"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openMovimientoModal(caja)}
                        className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                        title="Nuevo movimiento"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openMovimientosModal(caja)}
                        className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                        title="Ver historial"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                      {caja.estado === 'ABIERTA' ? (
                        <button
                          onClick={() => openCierreModal(caja)}
                          className="p-2 rounded transition-colors text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                          title="Cerrar caja (arqueo)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => openAperturaModal(caja)}
                          className="p-2 rounded transition-colors text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                          title="Abrir caja"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(caja)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
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
            <div className="text-slate-500 mb-4">
              No se encontraron cajas
            </div>
            <Button onClick={() => openAperturaModal()} size="sm">
              Abrir primera jornada
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
      </div>

      {/* Modal de Formulario */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Editar Caja</h3>
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

                {editingCaja && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-sky-700 mb-2">Información de la Caja</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-500">ID:</span>
                        <span className="text-slate-900 ml-2">#{editingCaja.id_caja}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Saldo Inicial:</span>
                        <span className="text-slate-900 ml-2">Bs. {formatPrice(editingCaja.saldo_inicial)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Saldo Actual:</span>
                        <span className="text-emerald-600 ml-2">Bs. {formatPrice(editingCaja.saldo_actual)}</span>
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
                    {loading ? 'Guardando...' : 'Actualizar'}
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

      {/* Modal Apertura de Caja */}
      {showAperturaModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Abrir jornada</h3>
              <button className="modal-close" onClick={closeAperturaModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleAperturaSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Punto de cobro</label>
                  <input
                    type="text"
                    value={aperturaFormData.descripcion}
                    onChange={(e) => setAperturaFormData({ ...aperturaFormData, descripcion: e.target.value })}
                    className="form-input"
                    placeholder="Ej. Recepción, Tienda..."
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    No se puede abrir una jornada con el mismo nombre de una que ya está abierta. Dentro de esta jornada podrás registrar cobros en Efectivo, QR, Transferencia y Tarjeta.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Saldo Inicial (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={aperturaFormData.saldo_inicial}
                    onChange={(e) => setAperturaFormData({ ...aperturaFormData, saldo_inicial: e.target.value })}
                    className="form-input"
                    placeholder="0.00"
                  />
                </div>

                <div className="modal-actions">
                  <button type="submit" className="btn-primary">
                    Abrir jornada
                  </button>
                  <button type="button" onClick={closeAperturaModal} className="btn-secondary">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cierre de Jornada (Arqueo) */}
      {showCierreModal && selectedCaja && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Cerrar jornada — {selectedCaja.descripcion}</h3>
              <button className="modal-close" onClick={closeCierreModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {cierreLoading || !cierreData ? (
                <div className="text-center py-8">
                  <div className="loading-spinner mx-auto mb-3"></div>
                  <p className="text-slate-500 text-sm">Calculando arqueo...</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Saldo inicial (efectivo)</span>
                      <span className="font-medium text-slate-900">Bs. {formatPrice(cierreData.saldo_inicial)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ingresos (todos los canales)</span>
                      <span className="font-medium text-emerald-600">+ Bs. {formatPrice(cierreData.total_ingresos)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Egresos (todos los canales)</span>
                      <span className="font-medium text-red-600">− Bs. {formatPrice(cierreData.total_egresos)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-700 font-semibold">Saldo registrado</span>
                      <span className="font-bold text-slate-700">Bs. {formatPrice(cierreData.saldo_registrado)}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      El saldo registrado incluye QR/Transferencia/Tarjeta: no es dinero físico, no se cuenta al cerrar.
                    </p>
                  </div>

                  {cierreData.desglose_por_canal && (
                    <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm">
                      <p className="text-slate-700 font-semibold mb-2">Canales de cobro</p>
                      <div className="space-y-1">
                        {CANALES_COBRO.map(canal => (
                          <div key={canal.codigo} className="flex justify-between">
                            <span className="text-slate-500">{canal.icono} {canal.nombre}</span>
                            <span className="font-medium text-slate-900">Bs. {formatPrice(cierreData.desglose_por_canal[canal.codigo])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-indigo-50 rounded-lg p-4 space-y-2 text-sm mb-4 border border-indigo-100">
                    <div className="flex justify-between">
                      <span className="text-indigo-700 font-semibold">Efectivo esperado</span>
                      <span className="font-bold text-indigo-700">Bs. {formatPrice(cierreData.efectivo_esperado)}</span>
                    </div>
                    <p className="text-xs text-indigo-400">
                      Esto es lo único que se cuenta físicamente al cerrar (QR/Transferencia/Tarjeta no son efectivo).
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Efectivo contado (Bs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={saldoContado}
                      onChange={(e) => setSaldoContado(e.target.value)}
                      className="form-input"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>

                  {saldoContado !== '' && !Number.isNaN(parseFloat(saldoContado)) && (
                    (() => {
                      const diferencia = Math.round((parseFloat(saldoContado) - cierreData.efectivo_esperado) * 100) / 100;
                      return (
                        <div className={`rounded-lg p-3 text-sm font-semibold text-center mb-4 ${
                          diferencia === 0 ? 'bg-emerald-50 text-emerald-700' :
                          diferencia > 0 ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {diferencia === 0
                            ? 'Efectivo cuadrado'
                            : diferencia > 0
                              ? `Sobrante de efectivo: Bs. ${diferencia.toFixed(2)}`
                              : `Faltante de efectivo: Bs. ${Math.abs(diferencia).toFixed(2)}`}
                        </div>
                      );
                    })()
                  )}

                  <div className="modal-actions">
                    <button type="button" onClick={handleConfirmarCierre} className="btn-primary">
                      Confirmar cierre de jornada
                    </button>
                    <button type="button" onClick={closeCierreModal} className="btn-secondary">
                      Cancelar
                    </button>
                  </div>
                </>
              )}
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
              <div className="mb-4 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                Saldo disponible: <span className="font-bold text-emerald-600">Bs. {formatPrice(selectedCaja?.saldo_actual)}</span>
              </div>
              <form onSubmit={handleMovimientoSubmit}>
                <div className="form-group">
                  <label className="text-slate-700 font-medium">Tipo de Movimiento</label>
                  <select
                    value={movimientoFormData.tipo_movimiento}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      tipo_movimiento: e.target.value
                    })}
                    className="form-input bg-white border-slate-300 text-slate-900"
                    required
                  >
                    <option value="Ingreso" className="bg-white text-emerald-700">Ingreso</option>
                    <option value="Egreso" className="bg-white text-red-700">Egreso</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-slate-700 font-medium">Origen</label>
                  <select
                    value={movimientoFormData.origen}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      origen: e.target.value
                    })}
                    className="form-input bg-white border-slate-300 text-slate-900"
                    required
                  >
                    <option value="Venta" className="bg-white text-sky-700">Venta</option>
                    <option value="Pago" className="bg-white text-emerald-700">Pago</option>
                    <option value="Otro" className="bg-white text-slate-600">Otro</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-slate-700 font-medium">Canal de cobro</label>
                  <select
                    value={movimientoFormData.canal_cobro}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      canal_cobro: e.target.value
                    })}
                    className="form-input bg-white border-slate-300 text-slate-900"
                    required
                  >
                    {CANALES_COBRO.map(canal => (
                      <option key={canal.codigo} value={canal.codigo}>{canal.icono} {canal.nombre}</option>
                    ))}
                  </select>
                  {movimientoFormData.tipo_movimiento === 'Egreso' && movimientoFormData.canal_cobro !== CANAL_EFECTIVO && (
                    <p className="text-xs text-slate-500 mt-1">
                      Un egreso en {movimientoFormData.canal_cobro} no reduce el efectivo físico de la jornada.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="text-slate-700 font-medium">Monto (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={movimientoFormData.tipo_movimiento === 'Egreso' ? (selectedCaja?.saldo_actual || 0) : undefined}
                    value={movimientoFormData.monto}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      monto: e.target.value
                    })}
                    className="form-input bg-white border-slate-300 text-slate-900"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="text-slate-700 font-medium">Descripción</label>
                  <textarea
                    value={movimientoFormData.descripcion}
                    onChange={(e) => setMovimientoFormData({
                      ...movimientoFormData,
                      descripcion: e.target.value
                    })}
                    className="form-input bg-white border-slate-300 text-slate-900"
                    placeholder="Describe el motivo del movimiento..."
                    rows="3"
                    required
                  ></textarea>
                </div>

                <div className="modal-actions">
                  <button type="submit" className="btn-primary">
                    Registrar Movimiento
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
              <h3>Historial de Movimientos - {selectedCaja.descripcion}</h3>
              <button onClick={() => setShowMovimientosModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Saldo Inicial:</span>
                    <span className="text-indigo-600 font-bold">Bs. {formatPrice(selectedCaja.saldo_inicial)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Saldo Actual:</span>
                    <span className="text-emerald-600 font-bold text-lg">Bs. {formatPrice(selectedCaja.saldo_actual)}</span>
                  </div>
                </div>
              </div>

              {/* Filtros del Historial */}
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-indigo-600 font-semibold text-lg">Filtros y Búsqueda</h4>
                  <button
                    onClick={limpiarFiltrosHistorial}
                    className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium"
                  >
                    Limpiar
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {/* Buscador general */}
                  <div className="md:col-span-3">
                    <label className="block text-slate-500 mb-1">Buscar en descripción o admin:</label>
                    <input
                      type="text"
                      value={historialSearch}
                      onChange={(e) => setHistorialSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    />
                  </div>

                  {/* Filtro por fechas */}
                  <div>
                    <label className="block text-slate-500 mb-1">Desde:</label>
                    <input
                      type="date"
                      value={historialFechaInicio}
                      onChange={(e) => setHistorialFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-slate-500 mb-1">Hasta:</label>
                    <input
                      type="date"
                      value={historialFechaFin}
                      onChange={(e) => setHistorialFechaFin(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    />
                  </div>

                  {/* Filtro por administrador */}
                  <div>
                    <label className="block text-slate-500 mb-1">Administrador:</label>
                    <select
                      value={historialAdminFilter}
                      onChange={(e) => setHistorialAdminFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
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
                    <label className="block text-slate-500 mb-1">Tipo:</label>
                    <select
                      value={historialTipoFilter}
                      onChange={(e) => setHistorialTipoFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    >
                      <option value="">Todos</option>
                      <option value="Ingreso">Ingreso</option>
                      <option value="Egreso">Egreso</option>
                    </select>
                  </div>

                  {/* Filtro por origen */}
                  <div>
                    <label className="block text-slate-500 mb-1">Origen:</label>
                    <select
                      value={historialOrigenFilter}
                      onChange={(e) => setHistorialOrigenFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    >
                      <option value="">Todos</option>
                      <option value="Pago">Pago</option>
                      <option value="Venta">Venta</option>
                      <option value="Desembolso">Desembolso</option>
                      <option value="Reembolso">Reembolso</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {/* Filtro por canal de cobro */}
                  <div>
                    <label className="block text-slate-500 mb-1">Canal:</label>
                    <select
                      value={historialCanalFilter}
                      onChange={(e) => setHistorialCanalFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    >
                      <option value="">Todos</option>
                      {CANALES_COBRO.map(canal => (
                        <option key={canal.codigo} value={canal.codigo}>{canal.icono} {canal.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contador de resultados */}
                <div className="mt-3 px-3 py-2 bg-blue-900/30 rounded-lg border border-blue-600/30">
                  <span className="text-sky-700 text-sm font-medium">
                    Mostrando {getMovimientosByCaja(selectedCaja.id_caja).length} movimiento(s)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Fecha</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Tipo</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Origen</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Canal</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Descripción</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Monto</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Admin</th>
                      <th className="px-4 py-3 text-left text-slate-700 font-semibold border-b border-slate-300">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-slate-50">
                    {getMovimientosByCaja(selectedCaja.id_caja).map((mov) => (
                      <tr key={mov.id_movimiento} className="hover:bg-slate-100 transition-colors">
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {formatFecha(mov.fecha_movimiento)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold px-2 py-1 rounded-md ${
                            mov.tipo_movimiento === 'Ingreso'
                              ? 'text-emerald-800 bg-emerald-100'
                              : 'text-red-800 bg-red-100'
                          }`}>
                            {mov.tipo_movimiento}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sky-700 font-medium">{mov.origen}</td>
                        <td className="px-4 py-3 text-slate-700">{mov.canal_cobro || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{mov.descripcion}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold text-lg ${
                            mov.tipo_movimiento === 'Ingreso'
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}>
                            {mov.tipo_movimiento === 'Ingreso' ? '+' : '-'}Bs. {formatPrice(mov.monto)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-indigo-600 font-medium">
                          {mov.Administrativo?.nombre || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          {puedeEliminarMovimiento(mov) ? (
                            <button
                              onClick={() => handleDeleteMovimiento(mov)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar movimiento"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          ) : (
                            <span
                              className="text-xs text-slate-400"
                              title={`Este movimiento viene de ${mov.origen === 'Pago' ? 'un pago' : mov.origen === 'Venta' ? 'una venta' : 'otro registro'}. Elimínalo desde su propia sección.`}
                            >
                              No editable
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {getMovimientosByCaja(selectedCaja.id_caja).length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                    <IconArchiveBox className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-600 text-lg font-medium">No hay movimientos registrados para esta caja</p>
                    <p className="text-slate-400 text-sm mt-2">Los movimientos aparecerán aquí cuando se registren</p>
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
              <h3>Exportación Completa de Cajas</h3>
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
                    PDF
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="excel"
                      checked={tipoExportacion === 'excel'}
                      onChange={(e) => setTipoExportacion(e.target.value)}
                      className="mr-2"
                    />
                    Excel
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
                
                <div className="max-h-48 overflow-y-auto border border-slate-300 rounded p-3 bg-slate-50">
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
                        <span className="text-slate-500">
                          (Saldo: Bs. {formatPrice(caja.saldo_actual)})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                
                <div className="text-sm text-slate-500 mt-2">
                  {cajasSeleccionadas.length === 0 
                    ? "Se exportarán todas las cajas" 
                    : `${cajasSeleccionadas.length} caja(s) seleccionada(s)`
                  }
                </div>
              </div>

              {/* Resumen de exportación */}
              <div className="bg-slate-50 p-4 rounded border border-slate-300">
                <h4 className="text-lg font-medium mb-2">Resumen de Exportación</h4>
                <ul className="text-sm text-slate-600 space-y-1">
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
                <IconDocumentDownload className="w-4 h-4 inline-block mr-1" /> Exportar {tipoExportacion.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check de éxito */}
      {showSuccessCheck && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <IconCheckCircle className="w-4 h-4" /> Movimiento registrado exitosamente
        </div>
      )}
    </div>
  );
}