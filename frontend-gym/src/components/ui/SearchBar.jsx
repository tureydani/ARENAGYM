'use client';
import React from 'react';
import '../../styles/modals.css';

const SearchBar = ({
  searchTerm,
  onSearchChange,
  placeholder = 'Buscar...',
  className = '',
  showClearButton = true
}) => {
  const handleClear = () => {
    onSearchChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-10 py-3 bg-gray-800/80 border border-purple-600/50 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all duration-200"
          placeholder={placeholder}
        />
        {showClearButton && searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <button
              type="button"
              onClick={handleClear}
              className="text-purple-400 hover:text-cyan-400 transition-colors duration-200 p-1 rounded-full hover:bg-purple-400/10"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
      {searchTerm && (
        <div className="mt-2 text-xs text-purple-400">
          Buscando: "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default SearchBar;