'use client';
import { useState, useEffect } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import SearchBar from './ui/SearchBar';
import Pagination from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import api from '../utils/api';
import '../styles/tables.css';
import '../styles/modals.css';

export default function TablaProductos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: ''
  });

  // Configuración de paginación
  const itemsPerPage = 8;
  
  // Asegurar que productos sea siempre un array
  const productosArray = Array.isArray(productos) ? productos : [];
  
  const { 
    currentPage, 
    totalPages, 
    paginatedData, 
    goToPage, 
    nextPage: goToNextPage,
    prevPage: goToPreviousPage,
    goToPage: goToFirstPage,
    goToPage: goToLastPage
  } = usePagination(productosArray.filter(producto => 
    producto.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  ), itemsPerPage);

  // Asegurar que paginatedData sea siempre un array
  const paginatedItems = Array.isArray(paginatedData) ? paginatedData : [];

  useEffect(() => {
    fetchProductos();
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

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/productos');
      
      // Asegurar que la respuesta sea un array
      const data = response.data || response || [];
      const productosData = Array.isArray(data) ? data : [];
      
      setProductos(productosData);
      console.log('Productos cargados:', productosData);
    } catch (error) {
      console.error('Error al obtener productos:', error);
      setProductos([]); // Asegurar que sea un array vacío en caso de error
      
      // Mostrar mensaje de error más específico
      if (error.response?.status === 404) {
        console.log('Endpoint /productos no encontrado');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('No se puede conectar al servidor backend');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre.trim() || !formData.precio.trim()) {
      alert('Por favor, complete los campos obligatorios (nombre y precio)');
      return;
    }

    // Validaciones adicionales según el modelo de DB
    const precio = parseFloat(formData.precio);
    const stock = parseInt(formData.stock) || 0;

    if (precio < 0) {
      alert('El precio no puede ser negativo');
      return;
    }

    if (stock < 0) {
      alert('El stock no puede ser negativo');
      return;
    }

    if (formData.nombre.trim().length > 100) {
      alert('El nombre del producto no puede exceder 100 caracteres');
      return;
    }

    try {
      const productoData = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        precio: precio,
        stock: stock
      };

      if (editingProducto) {
        await api.put(`/productos/${editingProducto.id_producto}`, productoData);
      } else {
        await api.post('/productos', productoData);
      }

      await fetchProductos();
      closeModal();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      
      // Mostrar errores específicos del servidor
      if (error.response?.data?.error) {
        alert(`Error: ${error.response.data.error}`);
      } else {
        alert('Error al guardar el producto. Verifique los datos ingresados.');
      }
    }
  };

  const handleEdit = (producto) => {
    setEditingProducto(producto);
    setFormData({
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      precio: producto.precio?.toString() || '',
      stock: producto.stock?.toString() || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (producto) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el producto "${producto.nombre}"?\n\nEsta acción no se puede deshacer y solo será posible si el producto no tiene ventas asociadas.`)) {
      try {
        await api.delete(`/productos/${producto.id_producto}`);
        await fetchProductos();
        alert('Producto eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar producto:', error);
        
        // Mostrar errores específicos del servidor
        if (error.response?.data?.error) {
          alert(`Error: ${error.response.data.error}`);
        } else if (error.response?.status === 400) {
          alert('No se puede eliminar el producto porque tiene ventas asociadas');
        } else {
          alert('Error al eliminar el producto. Inténtelo nuevamente.');
        }
      }
    }
  };

  const handleStockUpdate = async (producto, operacion) => {
    const cantidad = prompt(`¿Cuántas unidades desea ${operacion === 'suma' ? 'agregar' : 'quitar'} del stock?`);
    
    if (cantidad === null) return; // Usuario canceló
    
    const cantidadNum = parseInt(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      alert('Por favor, ingrese una cantidad válida mayor a 0');
      return;
    }

    try {
      await api.patch(`/productos/${producto.id_producto}/stock`, {
        cantidad: cantidadNum,
        operacion: operacion
      });
      await fetchProductos();
      alert(`Stock actualizado correctamente`);
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      
      if (error.response?.data?.error) {
        alert(`Error: ${error.response.data.error}`);
      } else {
        alert('Error al actualizar el stock');
      }
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0.00';
    const numPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    return numPrice.toFixed(2);
  };

  const formatStock = (stock) => {
    if (stock === null || stock === undefined) return 0;
    return typeof stock === 'number' ? stock : parseInt(stock) || 0;
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProducto(null);
    setFormData({
      nombre: '',
      descripcion: '',
      precio: '',
      stock: ''
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nombre', 'Descripción', 'Precio', 'Stock'];
    const csvContent = [
      headers.join(','),
      ...productosArray.map(producto => [
        producto.id_producto || '',
        `"${producto.nombre || ''}"`,
        `"${producto.descripcion || ''}"`,
        formatPrice(producto.precio),
        formatStock(producto.stock)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-purple-300">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container h-full flex flex-col relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Productos</h2>
          <p className="text-purple-300">Administra el catálogo de productos del gimnasio</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            📊 Exportar CSV
          </Button>
          <Button onClick={() => setShowModal(true)} size="sm">
            ➕ Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar productos por nombre o descripción..."
          />
        </div>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{productosArray.length}</div>
          <div className="text-sm text-purple-300">Total Productos</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {productosArray.reduce((sum, p) => sum + formatStock(p.stock), 0)}
          </div>
          <div className="text-sm text-purple-300">Total Stock</div>
        </Card>
      </div>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/30">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-700/30">
              {paginatedItems.map((producto) => (
                <tr key={producto.id_producto} className="hover:bg-purple-900/20 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-300">
                    #{producto.id_producto}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {producto.nombre}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-purple-200 max-w-xs truncate">
                      {producto.descripcion || 'Sin descripción'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-400">
                      Bs. {formatPrice(producto.precio)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      formatStock(producto.stock) > 10
                        ? 'bg-green-900/50 text-green-300'
                        : formatStock(producto.stock) > 0
                        ? 'bg-yellow-900/50 text-yellow-300'
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {formatStock(producto.stock)} unidades
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        onClick={() => handleEdit(producto)}
                        variant="outline"
                        size="sm"
                        className="text-blue-400 border-blue-400 hover:bg-blue-400"
                      >
                        ✏️ Editar
                      </Button>
                      <Button
                        onClick={() => handleStockUpdate(producto, 'suma')}
                        variant="outline"
                        size="sm"
                        className="text-green-400 border-green-400 hover:bg-green-400"
                        title="Agregar stock"
                      >
                        📦+ Stock
                      </Button>
                      <Button
                        onClick={() => handleStockUpdate(producto, 'resta')}
                        variant="outline"
                        size="sm"
                        className="text-yellow-400 border-yellow-400 hover:bg-yellow-400"
                        title="Reducir stock"
                      >
                        📦- Stock
                      </Button>
                      <Button
                        onClick={() => handleDelete(producto)}
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
                      >
                        🗑️ Eliminar
                      </Button>
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
              📦 No se encontraron productos
            </div>
            <Button onClick={() => setShowModal(true)} size="sm">
              Agregar primer producto
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
                {editingProducto ? 'Editar Producto' : 'Agregar Producto'}
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
                      onChange={(e) => handleInputChange('nombre', e.target.value)}
                      className="form-input"
                      placeholder="Nombre del producto"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Precio (Bs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.precio}
                      onChange={(e) => handleInputChange('precio', e.target.value)}
                      className="form-input"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => handleInputChange('stock', e.target.value)}
                    className="form-input"
                    placeholder="Cantidad disponible"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                    className="form-input"
                    rows="4"
                    placeholder="Descripción del producto..."
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Guardando...' : (editingProducto ? 'Actualizar' : 'Guardar')}
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