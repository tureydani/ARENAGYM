'use client';
import { useState, useMemo } from 'react';

export const usePagination = (data, itemsPerPage = 10, customSearchFunction = null) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar datos basado en el término de búsqueda
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    // Si hay una función de búsqueda personalizada, usarla
    if (customSearchFunction) {
      return customSearchFunction(data, searchTerm.trim());
    }
    
    // Búsqueda por defecto mejorada
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    
    return data.filter(item => {
      // Convertir todos los valores del objeto a texto
      const searchableText = Object.values(item)
        .filter(value => value !== null && value !== undefined)
        .map(value => value.toString().toLowerCase())
        .join(' ');
      
      // Verificar que todas las palabras de búsqueda estén presentes
      return searchWords.every(word => searchableText.includes(word));
    });
  }, [data, searchTerm, customSearchFunction]);

  // Calcular datos paginados
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // Mostrar los registros más recientes primero
    const sortedData = [...filteredData].reverse();
    return sortedData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // Calcular información de paginación
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const totalItems = filteredData.length;
  const startItem = filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);

  // Funciones de navegación
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Cuando cambia el término de búsqueda, resetear a la primera página
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  return {
    // Datos
    paginatedData,
    filteredData,
    
    // Estado
    currentPage,
    totalPages,
    totalItems,
    startItem,
    endItem,
    searchTerm,
    itemsPerPage,
    
    // Acciones
    goToPage,
    nextPage,
    prevPage,
    resetPagination,
    handleSearch,
    setSearchTerm,
    
    // Utilidades
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages
  };
};