'use client';
import { useEffect, useState } from 'react';
import api from '../utils/api';
import { usePagination } from '../hooks/usePagination';
import { SearchBar, Pagination, IconDocumentDownload, IconShoppingCart } from './ui';
import ModalVentaRapida from './ModalVentaRapida';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import '../styles/tables.css';
import '../styles/modals.css';

export default function TablaRegistroMembresias() {
  const [registros, setRegistros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosCompletos, setUsuariosCompletos] = useState([]); // Para información histórica
  const [membresias, setMembresias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState(null);

  // Nuevos estados para funcionalidades mejoradas
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showVentaModal, setShowVentaModal] = useState(false);
  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUserText, setSelectedUserText] = useState('');
  const [newUserData, setNewUserData] = useState({
    nombre: '',
    apellido: '',
    fecha_nacimiento: '',
    telefono: ''
  });
  
  // Estados para feedback de registro
  const [registroCompletado, setRegistroCompletado] = useState(false);
  const [registroFallido, setRegistroFallido] = useState(false);
  const [detalleError, setDetalleError] = useState('');

  // Estados para exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [tipoExportacion, setTipoExportacion] = useState('pdf');
  const [filtroFecha, setFiltroFecha] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Funciones de exportación
  const filtrarRegistrosPorFecha = () => {
    let registrosFiltrados = [...registros];

    switch (filtroFecha) {
      case 'semana':
        const semanaAtras = new Date();
        semanaAtras.setDate(semanaAtras.getDate() - 7);
        registrosFiltrados = registros.filter(registro => {
          const fechaInicio = new Date(registro.fecha_inicio);
          return fechaInicio >= semanaAtras;
        });
        break;
      case 'mes':
        const mesAtras = new Date();
        mesAtras.setMonth(mesAtras.getMonth() - 1);
        registrosFiltrados = registros.filter(registro => {
          const fechaInicio = new Date(registro.fecha_inicio);
          return fechaInicio >= mesAtras;
        });
        break;
      case 'personalizado':
        if (fechaInicio && fechaFin) {
          registrosFiltrados = registros.filter(registro => {
            const fechaRegistro = new Date(registro.fecha_inicio);
            return fechaRegistro >= new Date(fechaInicio) && fechaRegistro <= new Date(fechaFin);
          });
        }
        break;
      default:
        break;
    }

    return registrosFiltrados;
  };

  const exportarPDF = () => {
    const registrosFiltrados = filtrarRegistrosPorFecha();
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Reporte de Registros de Membresías - Gimnasio', 20, 20);

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
    doc.text(`Total de registros: ${registrosFiltrados.length}`, 20, 45);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 20, 55);

    const tableData = registrosFiltrados.map(registro => {
      const usuario = usuarios.find(u => u.id_usuario === registro.id_usuario);
      const membresia = membresias.find(m => m.id_membresia === registro.id_membresia);
      const admin = usuario?.Administrativo || null;
      
      return [
        registro.id_registro,
        usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario no encontrado',
        membresia ? membresia.tipo : 'Membresía no encontrada',
        formatFecha(registro.fecha_inicio),
        formatFecha(registro.fecha_fin),
        registro.activo ? 'Activo' : 'Inactivo',
        admin ? `${admin.nombre} ${admin.apellido}` : `Admin ID: ${registro.id_admin}`
      ];
    });

    autoTable(doc, {
      head: [['ID', 'Cliente', 'Membresía', 'F. Inicio', 'F. Fin', 'Estado', 'Registrado Por']],
      body: tableData,
      startY: 65,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const fechaArchivo = new Date().toISOString().split('T')[0];
    doc.save(`registros_membresias_${filtroFecha}_${fechaArchivo}.pdf`);

    setShowExportModal(false);
    setSuccess('PDF exportado exitosamente');
    setTimeout(() => setSuccess(''), 3000);
  };

  const exportarExcel = () => {
    const registrosFiltrados = filtrarRegistrosPorFecha();
    
    const datosExcel = registrosFiltrados.map(registro => {
      const usuario = usuarios.find(u => u.id_usuario === registro.id_usuario);
      const membresia = membresias.find(m => m.id_membresia === registro.id_membresia);
      const admin = usuario?.Administrativo || null;
      
      return {
        'ID Registro': registro.id_registro,
        'Cliente': usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario no encontrado',
        'Email Cliente': 'N/A',
        'Teléfono Cliente': usuario?.telefono || 'N/A',
        'Tipo Membresía': membresia ? membresia.tipo : 'Membresía no encontrada',
        'Duración (días)': membresia ? membresia.duracion_dias : 'N/A',
        'Precio': membresia ? `Bs. ${membresia.precio}` : 'N/A',
        'Fecha Inicio': formatFecha(registro.fecha_inicio),
        'Fecha Fin': formatFecha(registro.fecha_fin),
        'Estado': registro.activo ? 'Activo' : 'Inactivo',
        'Registrado Por': admin ? `${admin.nombre} ${admin.apellido}` : `Admin ID: ${registro.id_admin}`,
        'ID Admin': registro.id_admin
      };
    });

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros Membresías');

    const resumenData = [
      ['REPORTE DE REGISTROS DE MEMBRESÍAS - GIMNASIO'],
      [''],
      ['Filtro aplicado:', filtroFecha === 'personalizado' ? `${fechaInicio} a ${fechaFin}` : filtroFecha],
      ['Total de registros:', registrosFiltrados.length],
      ['Registros activos:', registrosFiltrados.filter(r => r.activo).length],
      ['Registros inactivos:', registrosFiltrados.filter(r => !r.activo).length],
      ['Fecha de generación:', new Date().toLocaleDateString()],
      ['Hora de generación:', new Date().toLocaleTimeString()]
    ];

    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen');

    const fechaArchivo = new Date().toISOString().split('T')[0];
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `registros_membresias_${filtroFecha}_${fechaArchivo}.xlsx`);

    setShowExportModal(false);
    setSuccess('Excel exportado exitosamente');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleExportar = () => {
    if (tipoExportacion === 'pdf') {
      exportarPDF();
    } else {
      exportarExcel();
    }
  };

  // Función de búsqueda específica para registro de membresías
  const searchRegistros = (data, searchTerm) => {
    if (!usuarios.length || !membresias.length) {
      // Si no están cargados los datos relacionados, búsqueda simple
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
      return data.filter(registro => {
        const searchableFields = [
          registro.id_registro?.toString() || '',
          registro.id_usuario?.toString() || '',
          registro.id_membresia?.toString() || '',
          registro.activo ? 'activo' : 'inactivo',
          formatFecha(registro.fecha_inicio) || '',
          formatFecha(registro.fecha_fin) || ''
        ].map(field => field.toString().toLowerCase());
        
        const searchableText = searchableFields.join(' ');
        return searchWords.every(word => searchableText.includes(word));
      });
    }
    
    // Búsqueda avanzada con datos relacionados
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    
    return data.filter(registro => {
      const usuario = usuarios.find(u => u.id_usuario === registro.id_usuario);
      const membresia = membresias.find(m => m.id_membresia === registro.id_membresia);
      const usuarioNombre = usuario ? `${usuario.nombre} ${usuario.apellido}` : '';
      const membresiaTipo = membresia ? membresia.tipo : '';
      
      const searchableFields = [
        registro.id_registro?.toString() || '',
        usuarioNombre,
        membresiaTipo,
        registro.activo ? 'activo' : 'inactivo',
        formatFecha(registro.fecha_inicio) || '',
        formatFecha(registro.fecha_fin) || ''
      ].map(field => field.toString().toLowerCase());
      
      const searchableText = searchableFields.join(' ');
      return searchWords.every(word => searchableText.includes(word));
    });
  };

  // Hook de paginación y búsqueda con función personalizada
  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    startItem,
    endItem,
    searchTerm,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    handleSearch
  } = usePagination(registros, 8, searchRegistros);

  const [formData, setFormData] = useState({
    id_usuario: '',
    id_membresia: '',
    fecha_inicio: '',
    fecha_fin: '',
    activo: true,
    // Nuevos campos para pago directo
    registrarPago: true,
    montoPago: '',
    estadoPago: 'Completo'
  });

  useEffect(() => {
    fetchRegistros();
    fetchUsuarios();
    fetchUsuariosCompletos();
    fetchMembresias();
  }, []);

  // Efecto para filtrar usuarios según búsqueda
  useEffect(() => {
    if (searchUsuarios.trim() === '') {
      setFilteredUsuarios([]);
      setShowUserDropdown(false);
    } else {
      const filtered = usuarios.filter(usuario => {
        const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
        const telefono = usuario.telefono || '';
        const searchTerm = searchUsuarios.toLowerCase();
        
        return nombreCompleto.includes(searchTerm) ||
               telefono.includes(searchTerm);
      });
      setFilteredUsuarios(filtered);
      setShowUserDropdown(filtered.length > 0);
    }
  }, [usuarios, searchUsuarios]);

  // Función para seleccionar usuario del autocompletado
  const handleSelectUser = (usuario) => {
    const userText = `${usuario.nombre} ${usuario.apellido}${usuario.telefono ? ` - ${usuario.telefono}` : ''}`;
    setSelectedUserText(userText);
    setSearchUsuarios(userText);
    setFormData({...formData, id_usuario: usuario.id_usuario});
    setShowUserDropdown(false);
  };

  // Función para limpiar selección de usuario
  const clearUserSelection = () => {
    setSelectedUserText('');
    setSearchUsuarios('');
    setFormData({...formData, id_usuario: ''});
    setShowUserDropdown(false);
  };

  // Función para manejar cambios en el input de búsqueda
  const handleSearchChange = (value) => {
    setSearchUsuarios(value);
    if (value !== selectedUserText) {
      setFormData({...formData, id_usuario: ''});
      setSelectedUserText('');
    }
  };

  // Efecto para cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-search-container')) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const res = await api.get('/registro-membresias');
      setRegistros(res.data);
      setError('');
    } catch (err) {
      setError('Error al cargar registros de membresías');
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      // Solo obtenemos usuarios activos para el buscador de nuevos registros
      const res = await api.get('/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error('Error al cargar usuarios');
    }
  };

  const fetchUsuariosCompletos = async () => {
    try {
      // Obtenemos todos los usuarios (incluidos inactivos) para mostrar información histórica
      const res = await api.get('/usuarios?includeInactive=true');
      setUsuariosCompletos(res.data);
    } catch (err) {
      console.error('Error al cargar usuarios completos');
    }
  };

  const fetchMembresias = async () => {
    try {
      const res = await api.get('/membresias?includeInactive=true');
      setMembresias(res.data);
    } catch (err) {
      console.error('Error al cargar membresías');
    }
  };

  const getUsuarioNombre = (id) => {
    // Buscar primero en usuarios activos, luego en la lista completa
    let usuario = usuarios.find(u => u.id_usuario === id);
    if (!usuario) {
      usuario = usuariosCompletos.find(u => u.id_usuario === id);
    }
    return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario no encontrado';
  };

  const getMembresiaTipo = (id) => {
    const membresia = membresias.find(m => m.id_membresia === id);
    return membresia ? membresia.tipo : 'Membresía no encontrada';
  };

  const getMembresiaInfo = (id) => {
    const membresia = membresias.find(m => m.id_membresia === id);
    return membresia || { tipo: 'N/A', precio: 0, duracion_dias: 0 };
  };

  const calcularFechaFin = (fechaInicio, duracionDias) => {
    if (!fechaInicio || !duracionDias) return '';
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + parseInt(duracionDias));
    return fecha.toISOString().split('T')[0];
  };

  const createRegistro = async () => {
    try {
      setLoading(true);
      setRegistroCompletado(false);
      setRegistroFallido(false);
      setDetalleError('');
      
      // Obtener información del administrador
      const adminData = sessionStorage.getItem('admin');
      const admin = adminData ? JSON.parse(adminData) : null;
      
      if (!admin) {
        setRegistroFallido(true);
        setDetalleError('No se encontró información del administrador');
        setError('Error: No se encontró información del administrador');
        return;
      }
      
      let pagoExitoso = true;
      let mensajePago = '';
      
      try {
        // Primero crear el registro de membresía
        const registroResponse = await api.post('/registro-membresias', {
          id_usuario: formData.id_usuario,
          id_membresia: formData.id_membresia,
          id_admin: admin.id_admin,
          fecha_inicio: formData.fecha_inicio,
          activo: formData.activo
          // fecha_fin se calculará automáticamente por trigger de BD
        });

        // Si se marcó registrar pago, crear el pago también
        if (formData.registrarPago && formData.montoPago) {
          try {
            await api.post('/pagos', {
              id_registro: registroResponse.data.id_registro,
              id_admin: admin.id_admin,
              monto_pagado: parseFloat(formData.montoPago),
              estado_pago: formData.estadoPago
            });
            mensajePago = ' y pago';
          } catch (pagoError) {
            console.error('Error al registrar pago:', pagoError);
            pagoExitoso = false;
            setDetalleError('Registro creado exitosamente, pero falló el procesamiento del pago');
            setError('Registro creado pero error al procesar el pago');
          }
        }

        // Actualizar datos y cerrar modal
        await fetchRegistros();
        setShowModal(false);
        resetForm();
        setError('');
        
        // Establecer estado de éxito
        setRegistroCompletado(true);
        
        const mensaje = formData.registrarPago 
          ? (pagoExitoso 
              ? `Registro de membresía${mensajePago} creados exitosamente`
              : 'Registro creado, pago falló')
          : 'Registro de membresía creado exitosamente';
        
        setSuccess(mensaje);
        setTimeout(() => {
          setSuccess('');
          setRegistroCompletado(false);
        }, 4000);
        
      } catch (registroError) {
        console.error('Error al crear registro:', registroError);
        setRegistroFallido(true);
        setDetalleError(`Error en el registro: ${registroError.response?.data?.error || registroError.message}`);
        setError('Error al crear registro de membresía');
      }
      
    } catch (err) {
      console.error('Error general:', err);
      setRegistroFallido(true);
      setDetalleError(`Error general: ${err.message}`);
      setError('Error inesperado al procesar la solicitud');
    } finally {
      setLoading(false);
      // Auto-limpiar estados de error después de 5 segundos
      setTimeout(() => {
        setRegistroFallido(false);
        setDetalleError('');
      }, 5000);
    }
  };

  // Función para crear nuevo usuario
  const createNewUser = async () => {
    try {
      setLoading(true);
      setRegistroFallido(false);
      setDetalleError('');
      
      const adminData = sessionStorage.getItem('admin');
      const admin = adminData ? JSON.parse(adminData) : null;
      
      if (!admin) {
        setRegistroFallido(true);
        setDetalleError('No se encontró información del administrador para crear el usuario');
        setError('Error: No se encontró información del administrador');
        return;
      }

      const userResponse = await api.post('/usuarios', {
        ...newUserData,
        registrado_por: admin.id_admin
      });

      // Actualizar lista de usuarios y seleccionar el nuevo usuario
      await fetchUsuarios();
      await fetchUsuariosCompletos();
      
      // Seleccionar automáticamente el usuario recién creado
      const userText = `${newUserData.nombre} ${newUserData.apellido}${newUserData.telefono ? ` - ${newUserData.telefono}` : ''}`;
      setSelectedUserText(userText);
      setSearchUsuarios(userText);
      setFormData({
        ...formData,
        id_usuario: userResponse.data.id_usuario
      });

      // Limpiar datos del nuevo usuario y cerrar modal
      setNewUserData({
        nombre: '',
        apellido: '',
        fecha_nacimiento: '',
        telefono: ''
      });
      
      setShowNewUserModal(false);
      setSuccess('Usuario creado y seleccionado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error al crear usuario:', err);
      setRegistroFallido(true);
      setDetalleError(`Error al crear usuario: ${err.response?.data?.error || err.message}`);
      setError('Error al crear nuevo usuario');
      
      // Auto-limpiar error después de 5 segundos
      setTimeout(() => {
        setRegistroFallido(false);
        setDetalleError('');
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const updateRegistro = async () => {
    try {
      setLoading(true);
      await api.put(`/registro-membresias/${editingRegistro.id_registro}`, formData);
      await fetchRegistros();
      setShowModal(false);
      setEditingRegistro(null);
      resetForm();
      setError('');
      setSuccess('Registro de membresía actualizado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al actualizar registro de membresía');
    } finally {
      setLoading(false);
    }
  };

  const deleteRegistro = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro de membresía?')) {
      try {
        setLoading(true);
        await api.delete(`/registro-membresias/${id}`);
        await fetchRegistros();
        setError('');
        setSuccess('Registro de membresía eliminado exitosamente');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Error al eliminar registro de membresía');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingRegistro) {
      await updateRegistro();
    } else {
      await createRegistro();
    }
  };

  const resetForm = () => {
    setFormData({
      id_usuario: '',
      id_membresia: '',
      fecha_inicio: '',
      fecha_fin: '',
      activo: true,
      registrarPago: true,
      montoPago: '',
      estadoPago: 'Completo'
    });
    setSearchUsuarios('');
    setSelectedUserText('');
    setShowUserDropdown(false);
  };

  // Función para obtener fecha local en formato YYYY-MM-DD (corregida)
  const getFechaHoyLocal = () => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const openCreateModal = () => {
    setEditingRegistro(null);
    resetForm();
    setFormData({
      ...formData,
      fecha_inicio: getFechaHoyLocal() // Usar función local segura
    });
    setShowModal(true);
  };

  const openEditModal = (registro) => {
    setEditingRegistro(registro);
    setFormData({
      id_usuario: registro.id_usuario,
      id_membresia: registro.id_membresia,
      fecha_inicio: registro.fecha_inicio ? registro.fecha_inicio.split('T')[0] : '',
      fecha_fin: registro.fecha_fin ? registro.fecha_fin.split('T')[0] : '',
      activo: registro.activo,
      registrarPago: false,
      montoPago: '',
      estadoPago: 'Completo'
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRegistro(null);
    setError('');
    resetForm();
  };

  const openVentaModal = () => {
    setShowVentaModal(true);
  };

  const closeVentaModal = () => {
    setShowVentaModal(false);
  };

  const handleVentaSuccess = (message) => {
    setSuccess(message || 'Venta registrada exitosamente');
    setTimeout(() => setSuccess(''), 3000);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    
    // Extraer año, mes y día directamente de la cadena para evitar problemas de zona horaria
    const fechaStr = fecha.toString();
    let fechaParts;
    
    if (fechaStr.includes('T')) {
      // Si viene con hora, extraer solo la fecha
      fechaParts = fechaStr.split('T')[0].split('-');
    } else {
      // Si es solo fecha
      fechaParts = fechaStr.split('-');
    }
    
    if (fechaParts.length === 3) {
      const año = parseInt(fechaParts[0]);
      const mes = parseInt(fechaParts[1]) - 1; // Los meses en JavaScript son 0-indexados
      const dia = parseInt(fechaParts[2]);
      
      // Crear la fecha con zona horaria local
      const fechaLocal = new Date(año, mes, dia);
      
      return fechaLocal.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // Fallback al método original si no se puede parsear
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calcularDiasRestantes = (fechaFin) => {
    if (!fechaFin) return 'N/A';
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    // Parsear fecha de fin evitando problemas de zona horaria
    const fechaStr = fechaFin.toString();
    let fechaParts;
    
    if (fechaStr.includes('T')) {
      fechaParts = fechaStr.split('T')[0].split('-');
    } else {
      fechaParts = fechaStr.split('-');
    }
    
    let fin;
    if (fechaParts.length === 3) {
      const año = parseInt(fechaParts[0]);
      const mes = parseInt(fechaParts[1]) - 1;
      const dia = parseInt(fechaParts[2]);
      fin = new Date(año, mes, dia);
    } else {
      fin = new Date(fechaFin);
    }
    
    fin.setHours(23, 59, 59, 999); // Establecer al final del día
    
    const diferencia = fin - hoy;
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    
    if (dias < 0) return 'Vencida';
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return '1 día';
    return `${dias} días`;
  };

  const getEstadoRegistro = (activo, fechaFin) => {
    if (!activo) return 'Inactivo';
    if (!fechaFin) return 'Activo';
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    // Parsear fecha de fin evitando problemas de zona horaria
    const fechaStr = fechaFin.toString();
    let fechaParts;
    
    if (fechaStr.includes('T')) {
      fechaParts = fechaStr.split('T')[0].split('-');
    } else {
      fechaParts = fechaStr.split('-');
    }
    
    let fin;
    if (fechaParts.length === 3) {
      const año = parseInt(fechaParts[0]);
      const mes = parseInt(fechaParts[1]) - 1;
      const dia = parseInt(fechaParts[2]);
      fin = new Date(año, mes, dia);
    } else {
      fin = new Date(fechaFin);
    }
    
    fin.setHours(23, 59, 59, 999); // Establecer al final del día
    
    if (fin < hoy) return 'Vencido';
    
    const diferencia = fin - hoy;
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    
    if (dias <= 7) return 'Por vencer';
    return 'Activo';
  };

  const handleMembresiaChange = (membresiaId) => {
    const membresia = membresias.find(m => m.id_membresia === parseInt(membresiaId));
    if (membresia && formData.fecha_inicio) {
      const fechaFin = calcularFechaFin(formData.fecha_inicio, membresia.duracion_dias);
      setFormData({
        ...formData,
        id_membresia: membresiaId,
        fecha_fin: fechaFin,
        montoPago: membresia.precio.toString() // Auto-llenar el monto con el precio de la membresía
      });
    } else {
      setFormData({
        ...formData,
        id_membresia: membresiaId,
        montoPago: membresia ? membresia.precio.toString() : ''
      });
    }
  };

  const handleFechaInicioChange = (fecha) => {
    const membresia = membresias.find(m => m.id_membresia === parseInt(formData.id_membresia));
    if (membresia) {
      const fechaFin = calcularFechaFin(fecha, membresia.duracion_dias);
      setFormData({
        ...formData,
        fecha_inicio: fecha,
        fecha_fin: fechaFin
      });
    } else {
      setFormData({
        ...formData,
        fecha_inicio: fecha
      });
    }
  };

  const getRegistrosActivos = () => {
    return registros.filter(registro => 
      registro.activo && 
      new Date(registro.fecha_fin) > new Date()
    ).length;
  };

  const getRegistrosVencidos = () => {
    return registros.filter(registro => 
      registro.activo && 
      new Date(registro.fecha_fin) <= new Date()
    ).length;
  };

  return (
    <div className="table-container h-full flex flex-col relative">
      {/* Header */}
      <div className="table-header flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="table-title">Registro de Membresías</h2>
          <div className="stats-number text-lg">{totalItems}</div>
          <span className="text-sm text-slate-500">
            {searchTerm ? 'resultados encontrados' : 'registros totales'}
          </span>
          <div className="flex items-center space-x-4 text-xs">
            <div className="text-emerald-600">
              {getRegistrosActivos()} activos
            </div>
            <div className="text-red-400">
              {getRegistrosVencidos()} vencidos
            </div>
          </div>
        </div>
        <div className="table-actions">
          <button
            onClick={fetchRegistros}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            {loading ? (
              <div className="loading-spinner w-4 h-4"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refrescar
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="btn-info flex items-center gap-2"
          >
            <IconDocumentDownload className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={openVentaModal}
            className="btn-success flex items-center gap-2"
          >
            <IconShoppingCart className="w-4 h-4" />
            Venta Rápida
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary"
          >
            + Nuevo Registro
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="px-6 py-4 border-b border-slate-200">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          placeholder="Buscar por usuario, membresía, estado..."
          className="max-w-md"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 alert alert-error">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mx-6 mt-4 alert alert-success">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && registros.length === 0 && (
        <div className="px-6 py-8 text-center flex-1 flex items-center justify-center">
          <div>
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-slate-500">Cargando datos...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="table-wrapper flex-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario y Membresía</th>
                <th>Administrativo</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th>Tiempo Restante</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8">
                    <div className="text-slate-500">
                      {searchTerm ? 'No se encontraron registros que coincidan con la búsqueda' : 'No hay registros de membresías'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((registro) => {
                  const estado = getEstadoRegistro(registro.activo, registro.fecha_fin);
                  const membresiaInfo = getMembresiaInfo(registro.id_membresia);
                  
                  return (
                    <tr key={registro.id_registro}>
                      <td>{registro.id_registro}</td>
                      <td>
                        <div className="font-medium text-slate-900">
                          {getUsuarioNombre(registro.id_usuario)}
                        </div>
                        <div className="text-sm text-indigo-600">
                          {getMembresiaTipo(registro.id_membresia)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Bs. ${membresiaInfo.precio}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-yellow-400">
                          {registro.Administrativo ? 
                            `${registro.Administrativo.nombre} ${registro.Administrativo.apellido}` : 
                            `ID: ${registro.id_admin}`
                          }
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div className="text-green-400">
                            Inicio: {formatFecha(registro.fecha_inicio)}
                          </div>
                          <div className="text-orange-400">
                            Fin: {formatFecha(registro.fecha_fin)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${
                          estado === 'Activo' ? 'status-active' :
                          estado === 'Por vencer' ? 'status-pending' :
                          estado === 'Vencido' ? 'status-inactive' :
                          'status-inactive'
                        }`}>
                          {estado}
                        </span>
                      </td>
                      <td>
                        <div className={`font-medium ${
                          calcularDiasRestantes(registro.fecha_fin) === 'Vencida' ? 'text-red-400' :
                          calcularDiasRestantes(registro.fecha_fin).includes('día') && 
                          parseInt(calcularDiasRestantes(registro.fecha_fin)) <= 7 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {calcularDiasRestantes(registro.fecha_fin)}
                        </div>
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(registro)}
                            className="btn-secondary text-xs px-3 py-1"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteRegistro(registro.id_registro)}
                            className="btn-danger text-xs px-3 py-1"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingRegistro ? 'Editar Registro de Membresía' : 'Nuevo Registro de Membresía'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="modal-form">
                {/* Sección de Usuario con autocompletado */}
                <div className="form-group">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label">Usuario</label>
                    {!editingRegistro && (
                      <button
                        type="button"
                        onClick={() => setShowNewUserModal(true)}
                        className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                      >
                        + Nuevo Usuario
                      </button>
                    )}
                  </div>
                  
                  {!editingRegistro ? (
                    <div className="relative user-search-container">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar usuario por nombre o teléfono..."
                          value={searchUsuarios}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          onFocus={() => searchUsuarios && setShowUserDropdown(filteredUsuarios.length > 0)}
                          className="form-input pr-10"
                          required
                        />
                        
                        {/* Botón para limpiar selección */}
                        {(searchUsuarios || selectedUserText) && (
                          <button
                            type="button"
                            onClick={clearUserSelection}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      {/* Dropdown de autocompletado */}
                      {showUserDropdown && filteredUsuarios.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {filteredUsuarios.map((usuario) => (
                            <button
                              key={usuario.id_usuario}
                              type="button"
                              onClick={() => handleSelectUser(usuario)}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none border-b border-slate-100 last:border-b-0"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                  {usuario.nombre.charAt(0)}{usuario.apellido.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900">
                                    {usuario.nombre} {usuario.apellido}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {usuario.telefono && (
                                      <span className="text-green-400">{usuario.telefono}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                          
                          {/* Opción para crear nuevo usuario si no hay resultados */}
                          {searchUsuarios && filteredUsuarios.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setShowNewUserModal(true)}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none border-t border-slate-200"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-indigo-600">
                                    Crear nuevo usuario
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    No se encontraron usuarios con "{searchUsuarios}"
                                  </div>
                                </div>
                              </div>
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Validación visual */}
                      {formData.id_usuario && (
                        <div className="mt-2 flex items-center space-x-2 text-sm text-green-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Usuario seleccionado correctamente</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Para edición, mostrar usuario fijo
                    <div className="form-input bg-slate-50 text-slate-400 cursor-not-allowed">
                      {usuarios.find(u => u.id_usuario === formData.id_usuario)?.nombre} {usuarios.find(u => u.id_usuario === formData.id_usuario)?.apellido}
                      <span className="text-xs ml-2">(No editable)</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de Membresía</label>
                  <select
                    value={formData.id_membresia}
                    onChange={(e) => handleMembresiaChange(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">Selecciona una membresía</option>
                    {membresias.map((membresia) => (
                      <option key={membresia.id_membresia} value={membresia.id_membresia}>
                        {membresia.tipo} - {membresia.precio} Bs ({membresia.duracion_dias} días)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Fecha de Inicio</label>
                    <input
                      type="date"
                      value={formData.fecha_inicio}
                      onChange={(e) => handleFechaInicioChange(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Fecha de Fin</label>
                    <input
                      type="date"
                      value={formData.fecha_fin}
                      onChange={(e) => setFormData({...formData, fecha_fin: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.activo}
                      onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                      className="mr-2"
                    />
                    <span className="form-label mb-0">Membresía activa</span>
                  </label>
                </div>

                {/* Sección de Pago Directo */}
                {!editingRegistro && (
                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <div className="form-group">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.registrarPago}
                          onChange={(e) => setFormData({...formData, registrarPago: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="form-label mb-0 text-indigo-600">
                          Registrar pago inmediatamente
                        </span>
                      </label>
                      <p className="text-xs text-slate-500 mt-1">
                        Marca esta opción para registrar el pago al mismo tiempo que la membresía
                      </p>
                    </div>

                    {formData.registrarPago && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="form-group">
                          <label className="form-label">Monto del Pago (Bs)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.montoPago}
                            onChange={(e) => setFormData({...formData, montoPago: e.target.value})}
                            className="form-input"
                            placeholder="0.00"
                            required={formData.registrarPago}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Estado del Pago</label>
                          <select
                            value={formData.estadoPago}
                            onChange={(e) => setFormData({...formData, estadoPago: e.target.value})}
                            className="form-select"
                          >
                            <option value="Completo">Completo</option>
                            <option value="Parcial">Parcial</option>
                            <option value="Pendiente">Pendiente</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {formData.fecha_inicio && formData.fecha_fin && (
                  <div className="p-3 bg-slate-50 rounded-md mt-4">
                    <p className="text-sm text-slate-500">
                      <strong>Resumen del Registro:</strong>
                      <br />
                      Inicio: {formatFecha(formData.fecha_inicio)}
                      <br />
                      Fin: {formatFecha(formData.fecha_fin)}
                      <br />
                      Duración: {calcularDiasRestantes(formData.fecha_fin)} desde el inicio
                      {formData.registrarPago && formData.montoPago && (
                        <>
                          <br />
                          <span className="text-indigo-600">
                            Pago: {formData.montoPago} Bs ({formData.estadoPago})
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`btn-primary relative ${loading ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="loading-spinner w-4 h-4"></div>
                        <span>
                          {formData.registrarPago ? 'Procesando registro y pago...' : 'Creando registro...'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {editingRegistro ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Actualizar</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Crear Registro</span>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    className={`btn-secondary ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de Registro Completado */}
      {registroCompletado && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center space-x-3 border-l-4 border-emerald-300">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Registro Completado</p>
              <p className="text-sm text-green-100">La operación se realizó exitosamente</p>
            </div>
            <button 
              onClick={() => setRegistroCompletado(false)}
              className="ml-4 text-emerald-100 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Indicador de Registro Fallido */}
      {registroFallido && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center space-x-3 border-l-4 border-red-300 max-w-md">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold">Registro Fallido</p>
              <p className="text-sm text-red-100">Ocurrió un error durante el proceso</p>
              {detalleError && (
                <p className="text-xs text-red-100 mt-1 bg-red-700/30 p-2 rounded">
                  {detalleError}
                </p>
              )}
            </div>
            <button 
              onClick={() => {
                setRegistroFallido(false);
                setDetalleError('');
              }}
              className="ml-4 text-red-100 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Modal para Crear Nuevo Usuario */}
      {showNewUserModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Nuevo Usuario</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowNewUserModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  createNewUser();
                }} 
                className="modal-form"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-sm">Nombre *</label>
                    <input
                      type="text"
                      value={newUserData.nombre}
                      onChange={(e) => setNewUserData({...newUserData, nombre: e.target.value})}
                      className="form-input text-sm"
                      required
                      placeholder="Nombre"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label text-sm">Apellido *</label>
                    <input
                      type="text"
                      value={newUserData.apellido}
                      onChange={(e) => setNewUserData({...newUserData, apellido: e.target.value})}
                      className="form-input text-sm"
                      required
                      placeholder="Apellido"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label text-sm">Teléfono</label>
                    <input
                      type="tel"
                      value={newUserData.telefono}
                      onChange={(e) => setNewUserData({...newUserData, telefono: e.target.value})}
                      className="form-input text-sm"
                      placeholder="78965412"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label text-sm">Fecha de Nacimiento</label>
                    <input
                      type="date"
                      value={newUserData.fecha_nacimiento}
                      onChange={(e) => setNewUserData({...newUserData, fecha_nacimiento: e.target.value})}
                      className="form-input text-sm"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-md">
                  <p className="text-xs text-slate-500">
                    <strong>Nota:</strong> Una vez creado, el usuario será seleccionado automáticamente 
                    para el registro de membresía.
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`btn-primary text-sm relative ${loading ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="loading-spinner w-4 h-4"></div>
                        <span>Creando usuario...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Crear Usuario</span>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewUserModal(false)}
                    disabled={loading}
                    className={`btn-secondary text-sm ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Venta Rápida */}
      <ModalVentaRapida
        isOpen={showVentaModal}
        onClose={closeVentaModal}
        onSuccess={handleVentaSuccess}
      />

      {/* Modal de Exportación */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">Exportar Datos de Registros</h3>
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
                  <strong>Vista previa:</strong> Se exportarán {filtrarRegistrosPorFecha().length} registros
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
}