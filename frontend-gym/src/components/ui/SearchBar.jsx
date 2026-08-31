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
            className="h-5 w-5 text-slate-400"
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
          className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors duration-200"
          placeholder={placeholder}
        />
        {showClearButton && searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-indigo-600 transition-colors duration-200 p-1 rounded-full hover:bg-slate-100"
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
        <div className="mt-2 text-xs text-slate-500">
          Buscando: "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default SearchBar;