'use client';
import { useEffect, useState } from 'react';
import api from '../utils/api';
import { usePagination } from '../hooks/usePagination';
import { SearchBar, Pagination } from './ui';
import '../styles/tables.css';
import '../styles/modals.css';

export default function TablaAdministrativos() {
  const [administrativos, setAdministrativos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  // Función para obtener fecha local en formato YYYY-MM-DD
  const getFechaHoyLocal = () => {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  // Función de búsqueda específica para administrativos
  const searchAdministrativos = (data, searchTerm) => {
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    
    return data.filter(admin => {
      const searchableFields = [
        admin.id_admin?.toString() || '', // Corregido: usar id_admin
        admin.nombre || '',
        admin.apellido || '',
        admin.usuario || '',
        `${admin.nombre || ''} ${admin.apellido || ''}`.trim(),
        new Date(admin.fecha_contratacion).toLocaleDateString() || ''
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
  } = usePagination(administrativos, 8, searchAdministrativos);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    usuario: '',
    contraseña: '',
    fecha_contratacion: ''
  });

  useEffect(() => {
    fetchAdministrativos();
  }, []);

  const fetchAdministrativos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/administrativos');
      setAdministrativos(res.data);
      setError('');
    } catch (err) {
      setError('Error al cargar administrativos');
      setAdministrativos([]);
    } finally {
      setLoading(false);
    }
  };

  const createAdministrativo = async () => {
    try {
      setLoading(true);
      await api.post('/administrativos', formData);
      await fetchAdministrativos();
      setShowModal(false);
      resetForm();
      setError('');
      setSuccess('Administrativo creado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al crear administrativo');
    } finally {
      setLoading(false);
    }
  };

  const updateAdministrativo = async () => {
    try {
      setLoading(true);
      // Si no se cambió la contraseña, no la enviamos
      const dataToSend = { ...formData };
      if (!dataToSend.contraseña) {
        delete dataToSend.contraseña;
      }
      
      await api.put(`/administrativos/${editingAdmin.id_admin}`, dataToSend); // Corregido: usar id_admin
      await fetchAdministrativos();
      setShowModal(false);
      setEditingAdmin(null);
      resetForm();
      setError('');
      setSuccess('Administrativo actualizado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error al actualizar administrativo:', err);
      setError('Error al actualizar administrativo: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const deleteAdministrativo = async (id) => {
    if (window.confirm('⚠️ ¿Estás seguro de que quieres eliminar este administrativo?\n\nEsta acción no se puede deshacer y puede afectar otros registros asociados.')) {
      try {
        setLoading(true);
        await api.delete(`/administrativos/${id}`);
        await fetchAdministrativos();
        setError('');
        setSuccess('Administrativo eliminado exitosamente');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        console.error('Error al eliminar administrativo:', err);
        if (err.response?.status === 409) {
          setError('No se puede eliminar: Este administrativo tiene registros asociados (usuarios, pagos, etc.)');
        } else {
          setError('Error al eliminar administrativo: ' + (err.response?.data?.message || err.message));
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingAdmin) {
      await updateAdministrativo();
    } else {
      await createAdministrativo();
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      usuario: '',
      contraseña: '',
      fecha_contratacion: ''
    });
  };

  const openCreateModal = () => {
    setEditingAdmin(null);
    resetForm();
    const fechaHoy = getFechaHoyLocal();
    setFormData({
      ...formData,
      fecha_contratacion: fechaHoy // Usar fecha local segura
    });
    setShowModal(true);
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setFormData({
      nombre: admin.nombre,
      apellido: admin.apellido,
      usuario: admin.usuario,
      contraseña: '',  // No mostrar la contraseña actual
      fecha_contratacion: admin.fecha_contratacion ? admin.fecha_contratacion.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAdmin(null);
    setError('');
    resetForm();
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calcularAntiguedad = (fecha) => {
    if (!fecha) return 'N/A';
    const hoy = new Date();
    const fechaContratacion = new Date(fecha);
    const diferencia = hoy - fechaContratacion;
    const años = Math.floor(diferencia / (1000 * 60 * 60 * 24 * 365));
    const meses = Math.floor((diferencia % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
    
    if (años > 0) {
      return `${años} año${años > 1 ? 's' : ''} ${meses > 0 ? `y ${meses} mes${meses > 1 ? 'es' : ''}` : ''}`;
    } else if (meses > 0) {
      return `${meses} mes${meses > 1 ? 'es' : ''}`;
    } else {
      const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
      return `${dias} día${dias > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="table-container h-full flex flex-col relative">
      {/* Header */}
      <div className="table-header flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="table-title">Gestión de Administrativos</h2>
          <div className="stats-number text-lg">{totalItems}</div>
          <span className="text-sm text-purple-300">
            {searchTerm ? 'resultados encontrados' : 'administrativos registrados'}
          </span>
        </div>
        <div className="table-actions">
          <button
            onClick={fetchAdministrativos}
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
            onClick={openCreateModal}
            className="btn-primary"
          >
            + Nuevo Administrativo
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="px-6 py-4 border-b border-purple-700/30">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          placeholder="Buscar por nombre, apellido, usuario..."
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
      {loading && administrativos.length === 0 && (
        <div className="px-6 py-8 text-center flex-1 flex items-center justify-center">
          <div>
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-purple-300">Cargando datos...</p>
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
                <th>Nombre Completo</th>
                <th>Usuario</th>
                <th>Fecha Contratación</th>
                <th>Antigüedad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8">
                    <div className="text-purple-300">
                      {searchTerm ? 'No se encontraron administrativos que coincidan con la búsqueda' : 'No hay administrativos registrados'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((admin, index) => (
                  <tr key={`admin-${admin.id_admin}-${index}`}>
                    <td>{admin.id_admin}</td>
                    <td>
                      <div className="font-medium text-white">
                        {admin.nombre} {admin.apellido}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {admin.id_admin}
                      </div>
                    </td>
                    <td className="text-cyan-400 font-medium">
                      {admin.usuario}
                    </td>
                    <td>{formatFecha(admin.fecha_contratacion)}</td>
                    <td>
                      <div className="text-purple-300 font-medium">
                        {calcularAntiguedad(admin.fecha_contratacion)}
                      </div>
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(admin)}
                          className="btn-secondary text-xs px-3 py-1"
                          title="Editar administrativo"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteAdministrativo(admin.id_admin)}
                          className="btn-danger text-xs px-3 py-1"
                          title="Eliminar administrativo"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
                {editingAdmin ? 'Editar Administrativo' : 'Nuevo Administrativo'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="modal-form">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      className="form-input"
                      placeholder="Nombre del administrativo"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Apellido</label>
                    <input
                      type="text"
                      value={formData.apellido}
                      onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                      className="form-input"
                      placeholder="Apellido del administrativo"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Usuario</label>
                  <input
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({...formData, usuario: e.target.value})}
                    className="form-input"
                    placeholder="Nombre de usuario único"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {editingAdmin ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                  </label>
                  <input
                    type="password"
                    value={formData.contraseña}
                    onChange={(e) => setFormData({...formData, contraseña: e.target.value})}
                    className="form-input"
                    placeholder={editingAdmin ? "Dejar vacío para mantener la actual" : "Contraseña segura"}
                    required={!editingAdmin}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de Contratación</label>
                  <input
                    type="date"
                    value={formData.fecha_contratacion}
                    onChange={(e) => setFormData({...formData, fecha_contratacion: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>

                {formData.fecha_contratacion && (
                  <div className="p-3 bg-gray-800/50 rounded-md">
                    <p className="text-sm text-purple-300">
                      <strong>Vista previa:</strong> {formatFecha(formData.fecha_contratacion)}
                      <br />
                      <strong>Antigüedad actual:</strong> {calcularAntiguedad(formData.fecha_contratacion)}
                    </p>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Guardando...' : (editingAdmin ? 'Actualizar' : 'Crear')}
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
    </div>
  );
}