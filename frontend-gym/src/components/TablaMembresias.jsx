'use client';
import { useEffect, useState } from 'react';
import api from '../utils/api';
import { usePagination } from '../hooks/usePagination';
import { SearchBar, Pagination } from './ui';
import '../styles/tables.css';
import '../styles/modals.css';

export default function TablaMembresias() {
  const [membresias, setMembresias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMembresia, setEditingMembresia] = useState(null);

  // Función de búsqueda específica para membresías
  const searchMembresias = (data, searchTerm) => {
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    
    return data.filter(membresia => {
      const searchableFields = [
        membresia.id_membresia?.toString() || '',
        membresia.tipo || '',
        membresia.duracion_dias?.toString() || '',
        membresia.precio?.toString() || ''
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
  } = usePagination(membresias, 8, searchMembresias);

  const [formData, setFormData] = useState({
    tipo: '',
    duracion_dias: '',
    precio: ''
  });

  useEffect(() => {
    fetchMembresias();
  }, []);

  const fetchMembresias = async () => {
    setLoading(true);
    try {
      const res = await api.get('/membresias');
      setMembresias(res.data);
      setError('');
    } catch (err) {
      console.error('Error al cargar membresías:', err);
      setError('Error al cargar membresías');
      setMembresias([]);
    } finally {
      setLoading(false);
    }
  };

  const createMembresia = async () => {
    try {
      setLoading(true);
      await api.post('/membresias', formData);
      await fetchMembresias();
      setShowModal(false);
      resetForm();
      setError('');
      setSuccess('Membresía creada exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al crear membresía');
    } finally {
      setLoading(false);
    }
  };

  const updateMembresia = async () => {
    try {
      setLoading(true);
      await api.put(`/membresias/${editingMembresia.id_membresia}`, formData);
      await fetchMembresias();
      setShowModal(false);
      setEditingMembresia(null);
      resetForm();
      setError('');
      setSuccess('Membresía actualizada exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al actualizar membresía');
    } finally {
      setLoading(false);
    }
  };

  const deleteMembresia = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta membresía?')) {
      try {
        setLoading(true);
        await api.delete(`/membresias/${id}`);
        await fetchMembresias();
        setError('');
        setSuccess('Membresía eliminada exitosamente');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Error al eliminar membresía');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingMembresia) {
      await updateMembresia();
    } else {
      await createMembresia();
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: '',
      duracion_dias: '',
      precio: ''
    });
  };

  const openCreateModal = () => {
    setEditingMembresia(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (membresia) => {
    setEditingMembresia(membresia);
    setFormData({
      tipo: membresia.tipo || '',
      duracion_dias: membresia.duracion_dias ? String(membresia.duracion_dias) : '',
      precio: membresia.precio ? String(membresia.precio) : ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMembresia(null);
    setError('');
    resetForm();
  };

  const formatDuracion = (dias) => {
    if (dias >= 365) {
      const años = Math.floor(dias / 365);
      return `${años} año${años > 1 ? 's' : ''}`;
    } else if (dias >= 30) {
      const meses = Math.floor(dias / 30);
      return `${meses} mes${meses > 1 ? 'es' : ''}`;
    } else {
      return `${dias} día${dias > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="table-container h-full flex flex-col relative">
      {/* Header */}
      <div className="table-header flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="table-title">Gestión de Membresías</h2>
          <div className="stats-number text-lg">{totalItems}</div>
          <span className="text-sm text-slate-500">
            {searchTerm ? 'resultados encontrados' : 'membresías registradas'}
          </span>
          {membresias.length > 0 && (
            <div className="text-xs text-indigo-600">
              (Total cargadas: {membresias.length})
            </div>
          )}
        </div>
        <div className="table-actions">
          <button
            onClick={fetchMembresias}
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
            + Nueva Membresía
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="px-6 py-4 border-b border-slate-200">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          placeholder="Buscar membresías por tipo, duración, precio..."
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
      {loading && membresias.length === 0 && (
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
                <th>Tipo de Membresía</th>
                <th>Duración</th>
                <th>Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8">
                    <div className="text-slate-500">
                      {searchTerm ? (
                        <>No se encontraron membresías que coincidan con: "{searchTerm}"</>
                      ) : membresias.length === 0 ? (
                        <>No hay membresías registradas. <span className="text-indigo-600">Crea la primera membresía usando el botón "+ Nueva Membresía"</span></>
                      ) : (
                        'No hay datos para mostrar'
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((membresia) => (
                  <tr key={membresia.id_membresia}>
                    <td>{membresia.id_membresia}</td>
                    <td>
                      <div className="font-medium text-slate-900">
                        {membresia.tipo || 'Sin tipo definido'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        ID: {membresia.id_membresia}
                      </div>
                    </td>
                    <td>
                      <div className="text-indigo-600 font-medium">
                        {formatDuracion(membresia.duracion_dias)}
                      </div>
                      <div className="text-xs text-gray-500">
                        ({membresia.duracion_dias} días)
                      </div>
                    </td>
                    <td className="font-bold text-emerald-600">
                      Bs. {parseFloat(membresia.precio).toFixed(2)}
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(membresia)}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteMembresia(membresia.id_membresia)}
                          className="btn-danger text-xs px-3 py-1"
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
                {editingMembresia ? 'Editar Membresía' : 'Nueva Membresía'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Tipo de Membresía</label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    className="form-input"
                    placeholder="ej. Mensual, Anual, Premium..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Duración (días)</label>
                    <input
                      type="number"
                      value={formData.duracion_dias}
                      onChange={(e) => setFormData({...formData, duracion_dias: e.target.value})}
                      className="form-input"
                      placeholder="30, 365..."
                      min="1"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Precio</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precio}
                      onChange={(e) => setFormData({...formData, precio: e.target.value})}
                      className="form-input"
                      placeholder="0.00"
                      min="0"
                      required
                    />
                  </div>
                </div>

                {formData.duracion_dias && (
                  <div className="p-3 bg-slate-50 rounded-md">
                    <p className="text-sm text-slate-500">
                      <strong>Vista previa:</strong> {formatDuracion(parseInt(formData.duracion_dias) || 0)}
                    </p>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Guardando...' : (editingMembresia ? 'Actualizar' : 'Crear')}
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