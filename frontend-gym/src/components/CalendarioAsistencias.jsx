'use client';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Convierte el índice de getDay() (0=Dom..6=Sáb) al índice de columna Lun..Dom (0..6)
const indiceLunesAPrimero = (diaSemanaJs) => (diaSemanaJs === 0 ? 6 : diaSemanaJs - 1);

/**
 * Calendario mensual simple (7 columnas, Lun-Dom) que resalta los días
 * presentes en `diasMarcados` (array de strings "YYYY-MM-DD").
 *
 * `mes` es un string "YYYY-MM". `onCambiarMes` recibe el nuevo string "YYYY-MM".
 */
export default function CalendarioAsistencias({ mes, diasMarcados = [], onCambiarMes, loading = false }) {
  const [anioStr, mesStr] = (mes || '').split('-');
  const anio = parseInt(anioStr, 10);
  const mesIndex = parseInt(mesStr, 10) - 1; // 0-based

  const diasMarcadosSet = new Set(diasMarcados);

  const primerDiaDelMes = new Date(anio, mesIndex, 1);
  const cantidadDias = new Date(anio, mesIndex + 1, 0).getDate();
  const columnaInicio = indiceLunesAPrimero(primerDiaDelMes.getDay());

  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() === mesIndex;
  const hoyDia = hoy.getDate();

  const celdas = [];
  for (let i = 0; i < columnaInicio; i++) {
    celdas.push(null);
  }
  for (let dia = 1; dia <= cantidadDias; dia++) {
    celdas.push(dia);
  }

  const formatearFechaISO = (dia) => {
    const mm = String(mesIndex + 1).padStart(2, '0');
    const dd = String(dia).padStart(2, '0');
    return `${anio}-${mm}-${dd}`;
  };

  const cambiarMes = (delta) => {
    if (!onCambiarMes) return;
    const nuevaFecha = new Date(anio, mesIndex + delta, 1);
    const nuevoMes = `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}`;
    onCambiarMes(nuevoMes);
  };

  const tituloMes = Number.isNaN(anio) || Number.isNaN(mesIndex)
    ? ''
    : `${NOMBRES_MES[mesIndex]} ${anio}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => cambiarMes(-1)}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-40"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-900 capitalize">{tituloMes}</span>
        <button
          type="button"
          onClick={() => cambiarMes(1)}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-40"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="text-center text-xs font-medium text-slate-400 py-1">
            {dia}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 gap-1 ${loading ? 'opacity-50' : ''}`}>
        {celdas.map((dia, idx) => {
          if (dia === null) {
            return <div key={`vacio-${idx}`} className="aspect-square" />;
          }
          const marcado = diasMarcadosSet.has(formatearFechaISO(dia));
          const esHoy = esMesActual && dia === hoyDia;
          return (
            <div
              key={dia}
              className={[
                'aspect-square flex items-center justify-center rounded-lg text-sm transition-colors',
                marcado
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-50 text-slate-600',
                esHoy && !marcado ? 'ring-2 ring-indigo-300' : '',
                esHoy && marcado ? 'ring-2 ring-indigo-800' : ''
              ].join(' ')}
            >
              {dia}
            </div>
          );
        })}
      </div>
    </div>
  );
}
