-- Trigger: refleja automáticamente cada venta insertada en el saldo de caja
-- y registra el movimiento correspondiente en movimientos_caja.
-- Extraído de backend-gym/limpiarTriggersVentas.js (versión final, más completa
-- que backend-gym/createVentasTrigger.js) antes de eliminar esos scripts de diagnóstico.

DROP TRIGGER IF EXISTS tg_reflejar_venta_en_caja ON ventas;
DROP FUNCTION IF EXISTS reflejar_venta_en_caja();

CREATE OR REPLACE FUNCTION reflejar_venta_en_caja()
RETURNS TRIGGER AS $$
DECLARE
    nombre_cliente TEXT;
BEGIN
    -- Obtener nombre completo del cliente
    SELECT u.nombre || ' ' || u.apellido INTO nombre_cliente
    FROM usuarios u
    WHERE u.id_usuario = NEW.id_usuario;

    -- Actualizar el saldo de la caja
    UPDATE cajas
    SET saldo_actual = saldo_actual + NEW.total
    WHERE id_caja = NEW.id_caja;

    -- Registrar el movimiento en la tabla de movimientos
    INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia)
    VALUES (NEW.id_caja, NEW.id_admin, 'Ingreso', 'Venta a ' || nombre_cliente, NEW.total, 'Venta', NEW.id_venta);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_reflejar_venta_en_caja
AFTER INSERT ON ventas
FOR EACH ROW
EXECUTE FUNCTION reflejar_venta_en_caja();
