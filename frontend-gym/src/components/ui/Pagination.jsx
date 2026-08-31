'use client';
import React from 'react';
import '../../styles/tables.css';

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  startItem,
  endItem,
  itemsPerPage,
  onPageChange,
  onNextPage,
  onPrevPage,
  hasNextPage,
  hasPrevPage,
  className = ''
}) => {
  // Generar números de página para mostrar
  const getPageNumbers = () => {
    const delta = 2; // Número de páginas a mostrar a cada lado de la actual
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) {
    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-white border-t border-slate-200 ${className}`}>
        <div className="text-sm text-slate-500">
          Mostrando {totalItems} {totalItems === 1 ? 'registro' : 'registros'}
        </div>
        <div className="text-xs text-slate-400">
          Página 1 de 1
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-white border-t border-slate-200 ${className}`}>
      {/* Información de registros */}
      <div className="flex items-center gap-3 text-center sm:text-left">
        <div className="text-xs sm:text-sm text-slate-500">
          Mostrando <span className="font-medium text-indigo-600">{startItem}</span> a{' '}
          <span className="font-medium text-indigo-600">{endItem}</span> de{' '}
          <span className="font-medium text-indigo-600">{totalItems}</span>
        </div>
        <div className="hidden sm:block text-xs text-slate-400">
          {itemsPerPage} por página
        </div>
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-2">
        {/* Botón anterior */}
        <button
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          className="inline-flex items-center px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <svg className="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Números de página: ocultos en móvil (no caben), se reemplazan por "X / Y" */}
        <div className="hidden sm:flex items-center space-x-1">
          {getPageNumbers().map((pageNumber, index) => (
            <React.Fragment key={index}>
              {pageNumber === '...' ? (
                <span className="px-3 py-2 text-sm text-slate-400">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(pageNumber)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    currentPage === pageNumber
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  {pageNumber}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="sm:hidden px-2 text-sm font-medium text-slate-600 whitespace-nowrap">
          {currentPage} / {totalPages}
        </div>

        {/* Botón siguiente */}
        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="inline-flex items-center px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <svg className="w-4 h-4 sm:ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Pagination;