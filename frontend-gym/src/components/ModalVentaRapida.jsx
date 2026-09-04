import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import '../styles/modal-venta-rapida-simple.css';

const ModalVentaRapida = ({ isOpen, onClose, onSuccess }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para el autocompletado de usuarios
  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUserText, setSelectedUserText] = useState('');
  
  // Estados para el carrito de productos
  const [carrito, setCarrito] = useState([]);

  // El modal se divide en 3 pasos en vez de mostrar todo junto: en pantallas
  // chicas, dos paneles con scroll independiente (productos + carrito) no
  // entraban a la vez y el carrito/botón de procesar quedaban cortados.
  // Un paso a la vez siempre entra completo, sin importar el tamaño de pantalla.
  const [paso, setPaso] = useState(1); // 1: Cliente y caja, 2: Productos, 3: Carrito

  // Estados para feedback de venta
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [ventaRealizada, setVentaRealizada] = useState(null);
  const [countdown, setCountdown] = useState(3);
  
  const [formData, setFormData] = useState({
    id_usuario: '',
    id_admin: 1, // Se reemplaza por el admin real de la sesión al abrir el modal
    id_caja: 1 // Primera caja por defecto
  });

  const userInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchUsuarios();
      fetchProductos();
      fetchCajas();
      // Reset estados
      setVentaExitosa(false);
      setVentaRealizada(null);
      setCountdown(3);
      setCarrito([]);
      setPaso(1);
      setSearchUsuarios('');
      setSelectedUserText('');

      const adminData = sessionStorage.getItem('admin');
      const admin = adminData ? JSON.parse(adminData) : null;

      setFormData({
        id_usuario: '',
        id_admin: admin?.id_admin || 1,
        id_caja: 1
      });
    }
  }, [isOpen]);

  // useEffect para manejar el countdown del cierre automático
  useEffect(() => {
    let countdownInterval;
    
    if (ventaExitosa && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Usar setTimeout para evitar setState en render
            setTimeout(() => {
              setVentaExitosa(false);
              setVentaRealizada(null);
              onClose();
            }, 0);
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [ventaExitosa, countdown, onClose]);

  const fetchCajas = async () => {
    try {
      const response = await api.get('/cajas');
      setCajas(response.data);
      // Seleccionar automáticamente la primera caja abierta
      const cajaAbierta = response.data.find(caja => caja.abierta);
      if (cajaAbierta) {
        setFormData(prev => ({ ...prev, id_caja: cajaAbierta.id_caja }));
      } else if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, id_caja: response.data[0].id_caja }));
      }
    } catch (error) {
      console.error('Error al obtener cajas:', error);
      alert('Error al cargar las cajas disponibles');
    }
  };

  // Efecto para filtrar usuarios
  useEffect(() => {
    if (searchUsuarios.trim() === '') {
      setFilteredUsuarios([]);
      setShowUserDropdown(false);
    } else {
      const filtered = usuarios.filter(usuario => {
        const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
        const email = (usuario.email || '').toLowerCase();
        const telefono = usuario.telefono || '';
        const searchTerm = searchUsuarios.toLowerCase();
        
        return nombreCompleto.includes(searchTerm) ||
               email.includes(searchTerm) ||
               telefono.includes(searchTerm);
      });
      
      setFilteredUsuarios(filtered);
      setShowUserDropdown(filtered.length > 0 && searchUsuarios !== selectedUserText);
    }
  }, [searchUsuarios, usuarios, selectedUserText]);

  // Manejar clics fuera para cerrar dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userInputRef.current && !userInputRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const fetchProductos = async () => {
    try {
      const response = await api.get('/productos');
      setProductos(response.data);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const seleccionarUsuario = (usuario) => {
    const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;
    setSearchUsuarios(nombreCompleto);
    setSelectedUserText(nombreCompleto);
    setFormData(prev => ({ ...prev, id_usuario: usuario.id_usuario }));
    setShowUserDropdown(false);
  };

  const clearUserSelection = () => {
    setSearchUsuarios('');
    setSelectedUserText('');
    setFormData(prev => ({ ...prev, id_usuario: '' }));
    setShowUserDropdown(false);
  };

  const validarStock = async (productoId, cantidadSolicitada) => {
    try {
      const response = await api.get(`/productos/${productoId}/verificar-stock`, {
        params: { cantidad: cantidadSolicitada }
      });
      return response.data.disponible;
    } catch (error) {
      console.error('Error al verificar stock:', error);
      return false;
    }
  };

  const agregarProducto = async (producto) => {
    const cantidadActualEnCarrito = carrito.find(item => item.id_producto === producto.id_producto)?.cantidad || 0;
    const nuevaCantidad = cantidadActualEnCarrito + 1;
    
    // Verificar stock en tiempo real
    const stockDisponible = await validarStock(producto.id_producto, nuevaCantidad);
    
    if (!stockDisponible) {
      alert(`Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}`);
      return;
    }

    const existente = carrito.find(item => item.id_producto === producto.id_producto);
    
    if (existente) {
      setCarrito(carrito.map(item =>
        item.id_producto === producto.id_producto
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      setCarrito([...carrito, {
        id_producto: producto.id_producto,
        nombre: producto.nombre,
        precio: parseFloat(producto.precio),
        precio_mayoreo: producto.precio_mayoreo != null ? parseFloat(producto.precio_mayoreo) : null,
        cantidad_mayoreo: producto.cantidad_mayoreo || null,
        cantidad: 1,
        stock: producto.stock
      }]);
    }
  };

  // Precio por unidad realmente aplicado a un item del carrito: el de mayoreo
  // si el producto tiene esa regla y la cantidad en el carrito ya la alcanza,
  // si no el precio normal.
  const precioEfectivo = (item) => {
    if (item.cantidad_mayoreo && item.precio_mayoreo != null && item.cantidad >= item.cantidad_mayoreo) {
      return item.precio_mayoreo;
    }
    return item.precio;
  };

  const actualizarCantidad = async (idProducto, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      setCarrito(carrito.filter(item => item.id_producto !== idProducto));
      return;
    }

    // Verificar stock antes de actualizar
    const stockDisponible = await validarStock(idProducto, nuevaCantidad);
    
    if (!stockDisponible) {
      alert('Stock insuficiente para esta cantidad');
      return;
    }

    setCarrito(carrito.map(item =>
      item.id_producto === idProducto
        ? { ...item, cantidad: nuevaCantidad }
        : item
    ));
  };

  const calcularTotal = () => {
    return carrito.reduce((total, item) => total + (precioEfectivo(item) * item.cantidad), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('=== INICIANDO VENTA ===');
      console.log('FormData:', formData);
      console.log('Carrito:', carrito);

      // Verificar que hay productos en el carrito
      if (carrito.length === 0) {
        alert('Debe agregar al menos un producto al carrito');
        setLoading(false);
        return;
      }

      // Verificar que se ha seleccionado un usuario
      if (!formData.id_usuario) {
        alert('Debe seleccionar un cliente');
        setLoading(false);
        return;
      }

      // Verificar que se ha seleccionado una caja
      if (!formData.id_caja) {
        alert('Debe seleccionar una caja');
        setLoading(false);
        return;
      }

      // Verificar stock final antes de procesar
      for (const item of carrito) {
        const stockDisponible = await validarStock(item.id_producto, item.cantidad);
        if (!stockDisponible) {
          throw new Error(`Stock insuficiente para ${item.nombre}`);
        }
      }

      // Crear la venta
      const total = calcularTotal();
      const ventaData = {
        id_usuario: formData.id_usuario,
        id_admin: formData.id_admin,
        id_caja: formData.id_caja,
        total: total,
        productos: carrito.map(item => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: precioEfectivo(item)
        }))
      };

      console.log('Datos de venta a enviar:', ventaData);

      const response = await api.post('/ventas', ventaData);
      console.log('Respuesta del servidor:', response.data);
      
      if (response.data) {
        setVentaRealizada({
          id: response.data.id_venta,
          cliente: selectedUserText || 'Cliente General',
          items: carrito.length,
          total: calcularTotal()
        });
        setVentaExitosa(true);
        
        // Actualizar productos para reflejar el nuevo stock
        await fetchProductos();
        
        if (onSuccess) {
          onSuccess(`Venta #${response.data.id_venta} registrada exitosamente - Total: Bs. ${total.toFixed(2)}`);
        }

        // Cerrar automáticamente el modal después de 3 segundos
        setCountdown(3);
      }
    } catch (error) {
      console.error('Error al procesar venta:', error);
      alert(error.response?.data?.message || error.message || 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  const puedeAvanzarAPaso2 = Boolean(formData.id_usuario) && Boolean(formData.id_caja);

  const irAlPaso = (destino) => setPaso(destino);
  const pasoSiguiente = () => setPaso((p) => Math.min(p + 1, 3));
  const pasoAnterior = () => setPaso((p) => Math.max(p - 1, 1));

  const NOMBRES_PASO = { 1: 'Cliente y caja', 2: 'Productos', 3: 'Carrito' };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container venta-rapida-modal-minimal" onClick={e => e.stopPropagation()}>
        <div className="modal-header-minimal">
          <h3>Venta Rápida</h3>
          <button className="modal-close-minimal" onClick={onClose}>×</button>
        </div>

        <div className="modal-body-minimal">
          {!ventaExitosa ? (
            <form onSubmit={handleSubmit} className="venta-rapida-form-minimal">
              {/* Indicador de pasos: reemplaza la vista de "todo junto" (dos
                  paneles con scroll independiente) que en móvil no entraba
                  completa. Un paso a la vez siempre entra en pantalla. */}
              <div className="pasos-indicador-minimal">
                {[1, 2, 3].map((n) => (
                  <React.Fragment key={n}>
                    <button
                      type="button"
                      className={`paso-dot-minimal ${paso === n ? 'activo' : ''} ${paso > n ? 'completado' : ''}`}
                      onClick={() => (n === 1 || puedeAvanzarAPaso2) && irAlPaso(n)}
                      disabled={n > 1 && !puedeAvanzarAPaso2}
                    >
                      <span className="paso-numero-minimal">{paso > n ? '✓' : n}</span>
                      <span className="paso-nombre-minimal">{NOMBRES_PASO[n]}</span>
                    </button>
                    {n < 3 && <div className={`paso-linea-minimal ${paso > n ? 'completado' : ''}`} />}
                  </React.Fragment>
                ))}
              </div>

              <div className="paso-contenido-minimal">
                {/* PASO 1: Cliente y Caja */}
                {paso === 1 && (
                  <div className="paso-panel-minimal">
                    <div className="input-group-minimal">
                      <label>Cliente</label>
                      <div className="user-search-minimal" ref={userInputRef}>
                        <input
                          type="text"
                          value={searchUsuarios}
                          onChange={(e) => setSearchUsuarios(e.target.value)}
                          placeholder="Buscar cliente..."
                          className="input-minimal"
                          autoComplete="off"
                        />
                        {selectedUserText && (
                          <button
                            type="button"
                            className="clear-btn"
                            onClick={clearUserSelection}
                          >
                            ✕
                          </button>
                        )}

                        {showUserDropdown && (
                          <div className="dropdown-minimal">
                            {filteredUsuarios.map(usuario => (
                              <div
                                key={usuario.id_usuario}
                                className="dropdown-item-minimal"
                                onClick={() => seleccionarUsuario(usuario)}
                              >
                                <span className="user-name-minimal">{usuario.nombre} {usuario.apellido}</span>
                                <small>{usuario.email} • {usuario.telefono}</small>
                              </div>
                            ))}
                            {filteredUsuarios.length === 0 && searchUsuarios.length > 0 && (
                              <div className="dropdown-item-minimal no-results">
                                No se encontraron usuarios
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="input-group-minimal">
                      <label>Caja</label>
                      <div className="caja-selector-minimal">
                        {cajas.length > 0 ? (
                          cajas.map(caja => (
                            <button
                              key={caja.id_caja}
                              type="button"
                              className={`caja-btn-minimal ${formData.id_caja === caja.id_caja ? 'active' : ''} ${!caja.abierta ? 'cerrada' : ''}`}
                              onClick={() => setFormData(prev => ({ ...prev, id_caja: caja.id_caja }))}
                              disabled={!caja.abierta}
                            >
                              <span className="caja-nombre">{caja.descripcion}</span>
                              <span className="caja-saldo-minimal">Bs. {parseFloat(caja.saldo_actual || 0).toFixed(2)}</span>
                            </button>
                          ))
                        ) : (
                          <div className="no-cajas-minimal">
                            No hay cajas disponibles
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* PASO 2: Productos */}
                {paso === 2 && (
                  <div className="paso-panel-minimal productos-panel-minimal">
                    <div className="panel-header-minimal">
                      <label>Productos Disponibles</label>
                    </div>

                    <div className="productos-grid-minimal">
                      {productos.length > 0 ? (
                        productos.map(producto => (
                          <div key={producto.id_producto} className="producto-card-minimal">
                            <div className="producto-info-minimal">
                              <span className="nombre-minimal">{producto.nombre}</span>
                              <div className="precio-stock-minimal">
                                <span className="precio-minimal">Bs. {parseFloat(producto.precio).toFixed(2)}</span>
                                <span className={`stock-minimal ${producto.stock <= 5 ? 'low-stock' : ''}`}>
                                  {producto.stock}
                                </span>
                              </div>
                              {producto.cantidad_mayoreo && producto.precio_mayoreo != null && (
                                <div className="precio-mayoreo-hint" style={{ fontSize: '0.7rem', color: '#b45309' }}>
                                  {producto.cantidad_mayoreo}+ = Bs. {parseFloat(producto.precio_mayoreo).toFixed(2)} c/u
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="add-btn-minimal"
                              onClick={() => agregarProducto(producto)}
                              disabled={producto.stock <= 0}
                            >
                              +
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="no-productos">
                          No hay productos disponibles
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PASO 3: Carrito y confirmación */}
                {paso === 3 && (
                  <div className="paso-panel-minimal carrito-panel-minimal">
                    <div className="panel-header-minimal">
                      <label>Carrito ({carrito.length})</label>
                    </div>

                    <div className="carrito-content-minimal">
                      {carrito.length > 0 ? (
                        <>
                          <div className="carrito-items-minimal">
                            {carrito.map(item => {
                              const precioUnitario = precioEfectivo(item);
                              const mayoreoAplicado = precioUnitario !== item.precio;
                              return (
                                <div key={item.id_producto} className="carrito-item-minimal">
                                  <div className="item-info-minimal">
                                    <span className="item-nombre">{item.nombre}</span>
                                    <span className="item-precio">
                                      Bs. {precioUnitario.toFixed(2)} c/u
                                      {mayoreoAplicado && (
                                        <span style={{ color: '#b45309', marginLeft: '0.4rem' }}>(precio por mayor)</span>
                                      )}
                                    </span>
                                    {!mayoreoAplicado && item.cantidad_mayoreo && (
                                      <small style={{ color: '#94a3b8' }}>
                                        Lleva {item.cantidad_mayoreo - item.cantidad} más y paga Bs. {item.precio_mayoreo.toFixed(2)} c/u
                                      </small>
                                    )}
                                  </div>
                                  <div className="item-controls-minimal">
                                    <div className="cantidad-controls">
                                      <button
                                        type="button"
                                        className="qty-btn"
                                        onClick={() => actualizarCantidad(item.id_producto, item.cantidad - 1)}
                                      >
                                        -
                                      </button>
                                      <span className="qty-display">{item.cantidad}</span>
                                      <button
                                        type="button"
                                        className="qty-btn"
                                        onClick={() => actualizarCantidad(item.id_producto, item.cantidad + 1)}
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="item-subtotal">Bs. {(precioUnitario * item.cantidad).toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="checkout-section-minimal">
                            <div className="total-display-minimal">
                              <span className="total-label">TOTAL:</span>
                              <span className="total-amount-minimal">Bs. {calcularTotal().toFixed(2)}</span>
                            </div>

                            <button
                              type="submit"
                              className="submit-btn-minimal"
                              disabled={loading || !formData.id_usuario || carrito.length === 0}
                            >
                              {loading ? (
                                <>
                                  <span className="spinner-minimal"></span>
                                  Procesando...
                                </>
                              ) : (
                                <>Procesar Venta</>
                              )}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="carrito-vacio-minimal">
                          <div className="empty-icon"></div>
                          <span>Sin productos seleccionados</span>
                          <small>Vuelve al paso anterior para agregar productos</small>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Navegación entre pasos */}
              {paso < 3 && (
                <div className="paso-navegacion-minimal">
                  {paso > 1 ? (
                    <button type="button" className="nav-btn-minimal atras" onClick={pasoAnterior}>
                      ← Atrás
                    </button>
                  ) : <span />}

                  <div className="paso-navegacion-derecha">
                    {paso === 2 && carrito.length > 0 && (
                      <div className="mini-resumen-carrito-minimal">
                        <span>{carrito.length} producto{carrito.length !== 1 ? 's' : ''}</span>
                        <span>Bs. {calcularTotal().toFixed(2)}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="nav-btn-minimal siguiente"
                      onClick={pasoSiguiente}
                      disabled={paso === 1 && !puedeAvanzarAPaso2}
                    >
                      {paso === 1 ? 'Siguiente →' : `Ir al carrito (${carrito.length}) →`}
                    </button>
                  </div>
                </div>
              )}
              {paso === 3 && (
                <div className="paso-navegacion-minimal">
                  <button type="button" className="nav-btn-minimal atras" onClick={pasoAnterior}>
                    ← Agregar más productos
                  </button>
                </div>
              )}
            </form>
          ) : (
            // Vista de éxito
            <div className="success-view-minimal">
              <div className="success-icon-minimal"></div>
              <h4>¡Venta Registrada Exitosamente!</h4>
              
              <div className="success-info">
                <span>Venta ID: #{ventaRealizada?.id || 'N/A'}</span>
                <span>Cliente: {ventaRealizada?.cliente || 'Cliente General'}</span>
                <span>Productos: {ventaRealizada?.items || 0} item(s)</span>
                <span className="total-amount">Total: Bs. {ventaRealizada?.total?.toFixed(2) || '0.00'}</span>
              </div>

              <div className="auto-close-info">
                <small>Se cerrará automáticamente en {countdown} segundo{countdown !== 1 ? 's' : ''}...</small>
              </div>
              
              <button 
                type="button" 
                className="submit-btn-minimal"
                onClick={() => {
                  setVentaExitosa(false);
                  setVentaRealizada(null);
                  onClose();
                }}
              >
                Nueva Venta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalVentaRapida;