'use client';
import { useState } from 'react';

// Modal genérico de confirmación con motivo obligatorio: se usa tanto
// para anular como para reactivar una asistencia (mismo formulario,
// distinto texto/acción). El motivo nunca es opcional (secciones 5, 6, 20
// y 21 del pedido): sin él no se habilita el botón de confirmar.
export default function ModalMotivoAccion({
  abierto,
  titulo,
  descripcion,
  cliente,
  fechaHoraTexto,
  placeholder,
  textoBoton,
  claseBoton = 'btn-primary',
  onConfirmar,
  onCerrar
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (!abierto) return null;

  const handleConfirmar = async () => {
    if (!motivo.trim()) {
      setError('El motivo es obligatorio');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await onConfirmar(motivo.trim());
      setMotivo('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar la acción');
    } finally {
      setEnviando(false);
    }
  };

  const handleCerrar = () => {
    setMotivo('');
    setError('');
    onCerrar();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCerrar()}>
      <div className="modal-container" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{titulo}</h3>
          <button className="modal-close" onClick={handleCerrar}>&times;</button>
        </div>
        <div className="modal-body">
          {descripcion && <p className="text-sm text-slate-500 mb-3">{descripcion}</p>}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-sm">
            <div className="font-medium text-slate-900">{cliente}</div>
            {fechaHoraTexto && <div className="text-slate-500">{fechaHoraTexto}</div>}
          </div>

          <div className="form-group">
            <label className="form-label modern">Motivo (obligatorio)</label>
            <textarea
              className="form-input modern"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>

          {error && <div className="alert alert-error mt-3"><span>{error}</span></div>}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={handleCerrar} disabled={enviando}>Cancelar</button>
          <button className={claseBoton} onClick={handleConfirmar} disabled={enviando || !motivo.trim()}>
            {enviando && <div className="loading-spinner w-4 h-4"></div>}
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
