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
      <div className={`flex items-center justify-between px-6 py-3 bg-gray-900/50 border-t border-purple-700/30 ${className}`}>
        <div className="text-sm text-purple-300">
          Mostrando {totalItems} {totalItems === 1 ? 'registro' : 'registros'}
        </div>
        <div className="text-xs text-gray-500">
          Página 1 de 1
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between px-6 py-4 bg-gray-900/50 border-t border-purple-700/30 ${className}`}>
      {/* Información de registros */}
      <div className="flex items-center space-x-4">
        <div className="text-sm text-purple-300">
          Mostrando <span className="font-medium text-cyan-400">{startItem}</span> a{' '}
          <span className="font-medium text-cyan-400">{endItem}</span> de{' '}
          <span className="font-medium text-cyan-400">{totalItems}</span> registros
        </div>
        <div className="text-xs text-gray-500">
          {itemsPerPage} por página
        </div>
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center space-x-2">
        {/* Botón anterior */}
        <button
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-300 bg-gray-800 border border-purple-700/50 rounded-lg hover:bg-purple-900/50 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>

        {/* Números de página */}
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((pageNumber, index) => (
            <React.Fragment key={index}>
              {pageNumber === '...' ? (
                <span className="px-3 py-2 text-sm text-gray-500">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(pageNumber)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentPage === pageNumber
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                      : 'text-purple-300 bg-gray-800 border border-purple-700/50 hover:bg-purple-900/50 hover:text-cyan-400'
                  }`}
                >
                  {pageNumber}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Botón siguiente */}
        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-300 bg-gray-800 border border-purple-700/50 rounded-lg hover:bg-purple-900/50 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          Siguiente
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Pagination;