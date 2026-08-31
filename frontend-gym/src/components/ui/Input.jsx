'use client';
import React from 'react';
import '../../styles/modals.css';

const Input = ({
  label,
  error,
  hint,
  icon,
  className = '',
  ...props
}) => {
  const inputClasses = `form-input ${error ? 'border-red-500 focus:border-red-400' : ''} ${className}`;
  
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-purple-400">
              {icon}
            </div>
          </div>
        )}
        
        <input
          className={`${inputClasses} ${icon ? 'pl-10' : ''}`}
          {...props}
        />
      </div>
      
      {error && (
        <div className="mt-1 text-sm text-red-400 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {error}
        </div>
      )}
      
      {hint && !error && (
        <div className="mt-1 text-xs text-purple-400">
          {hint}
        </div>
      )}
    </div>
  );
};

export default Input;