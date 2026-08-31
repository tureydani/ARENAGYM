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
    default: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
    active: 'status-active',
    inactive: 'status-inactive',
    pending: 'status-pending',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
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