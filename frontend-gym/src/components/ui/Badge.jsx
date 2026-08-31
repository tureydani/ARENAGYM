'use client';
import React from 'react';
import '../../styles/tables.css';

const Badge = ({ 
  children, 
  variant = 'default', 
  size = 'md',
  className = '',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium';
  
  const variants = {
    default: 'bg-slate-100 text-slate-600 border border-slate-200',
    active: 'status-active',
    inactive: 'status-inactive',
    pending: 'status-pending',
    success: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-600 border border-amber-200',
    error: 'bg-red-50 text-red-600 border border-red-200',
    info: 'bg-sky-50 text-sky-600 border border-sky-200',
    purple: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    cyan: 'bg-indigo-50 text-indigo-600 border border-indigo-200'
  };
  
  const sizes = {
    sm: 'px-2 py-1 text-xs rounded-md',
    md: 'status-badge',
    lg: 'px-4 py-2 text-sm rounded-lg'
  };
  
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;