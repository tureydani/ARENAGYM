-- ==========================================================
-- TRIGGERS PARA CONTROL DE STOCK
-- ==========================================================

-- Función para validar stock antes de actualizaciones
CREATE OR REPLACE FUNCTION validar_stock_positivo()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar que el stock no sea negativo
    IF NEW.stock < 0 THEN
        RAISE EXCEPTION 'El stock no puede ser negativo. Stock actual: %, Stock solicitado: %', OLD.stock, NEW.stock;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar stock en actualizaciones
CREATE OR REPLACE TRIGGER tg_validar_stock_positivo
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION validar_stock_positivo();

-- Función para validar stock en detalle de ventas
CREATE OR REPLACE FUNCTION validar_stock_detalle_venta()
RETURNS TRIGGER AS $$
DECLARE
    stock_actual INTEGER;
    nombre_producto VARCHAR(100);
BEGIN
    -- Obtener stock actual del producto
    SELECT stock, nombre INTO stock_actual, nombre_producto
    FROM productos 
    WHERE id_producto = NEW.id_producto;
    
    -- Verificar que hay suficiente stock
    IF stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para %. Stock disponible: %, cantidad solicitada: %', 
                       nombre_producto, stock_actual, NEW.cantidad;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar stock antes de crear detalle de venta
CREATE OR REPLACE TRIGGER tg_validar_stock_detalle_venta
    BEFORE INSERT ON detalle_ventas
    FOR EACH ROW
    EXECUTE FUNCTION validar_stock_detalle_venta();

-- Función para actualizar stock automáticamente en detalle de ventas
CREATE OR REPLACE FUNCTION actualizar_stock_detalle_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar stock del producto al crear detalle de venta
    UPDATE productos 
    SET stock = stock - NEW.cantidad 
    WHERE id_producto = NEW.id_producto;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock automáticamente
CREATE OR REPLACE TRIGGER tg_actualizar_stock_detalle_venta
    AFTER INSERT ON detalle_ventas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_stock_detalle_venta();

-- Función para restaurar stock al eliminar detalle de venta
CREATE OR REPLACE FUNCTION restaurar_stock_detalle_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Restaurar stock del producto al eliminar detalle de venta
    UPDATE productos 
    SET stock = stock + OLD.cantidad 
    WHERE id_producto = OLD.id_producto;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para restaurar stock al eliminar detalle
CREATE OR REPLACE TRIGGER tg_restaurar_stock_detalle_venta
    AFTER DELETE ON detalle_ventas
    FOR EACH ROW
    EXECUTE FUNCTION restaurar_stock_detalle_venta();

-- Función para manejar cambios en cantidad de detalle de venta
CREATE OR REPLACE FUNCTION actualizar_stock_cambio_detalle()
RETURNS TRIGGER AS $$
DECLARE
    diferencia INTEGER;
BEGIN
    -- Calcular diferencia en cantidad
    diferencia := NEW.cantidad - OLD.cantidad;
    
    -- Si hay diferencia, actualizar stock
    IF diferencia != 0 THEN
        UPDATE productos 
        SET stock = stock - diferencia 
        WHERE id_producto = NEW.id_producto;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manejar cambios en cantidad
CREATE OR REPLACE TRIGGER tg_actualizar_stock_cambio_detalle
    AFTER UPDATE ON detalle_ventas
    FOR EACH ROW
    WHEN (OLD.cantidad IS DISTINCT FROM NEW.cantidad)
    EXECUTE FUNCTION actualizar_stock_cambio_detalle();

-- ==========================================================
-- FUNCIÓN PARA VERIFICAR STOCK DISPONIBLE
-- ==========================================================

-- Función para verificar stock disponible para múltiples productos
CREATE OR REPLACE FUNCTION verificar_stock_disponible(productos_json JSON)
RETURNS TABLE(
    id_producto INTEGER,
    nombre VARCHAR(100),
    stock_actual INTEGER,
    cantidad_solicitada INTEGER,
    disponible BOOLEAN,
    stock_faltante INTEGER
) AS $$
DECLARE
    producto_item JSON;
BEGIN
    FOR producto_item IN SELECT * FROM json_array_elements(productos_json)
    LOOP
        RETURN QUERY
        SELECT 
            p.id_producto,
            p.nombre,
            p.stock,
            (producto_item->>'cantidad')::INTEGER,
            p.stock >= (producto_item->>'cantidad')::INTEGER,
            CASE 
                WHEN p.stock >= (producto_item->>'cantidad')::INTEGER THEN 0
                ELSE (producto_item->>'cantidad')::INTEGER - p.stock
            END
        FROM productos p
        WHERE p.id_producto = (producto_item->>'id_producto')::INTEGER;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================
-- VISTA PARA PRODUCTOS CON STOCK BAJO
-- ==========================================================

-- Vista para productos con stock bajo (configurable)
CREATE OR REPLACE VIEW productos_stock_bajo AS
SELECT 
    id_producto,
    nombre,
    descripcion,
    precio,
    stock,
    CASE 
        WHEN stock = 0 THEN 'Sin stock'
        WHEN stock <= 5 THEN 'Stock crítico'
        WHEN stock <= 10 THEN 'Stock bajo'
        ELSE 'Stock normal'
    END AS estado_stock
FROM productos
WHERE stock <= 10
ORDER BY stock ASC;