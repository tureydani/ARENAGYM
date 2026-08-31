'use client';
import React from 'react';
import '../../styles/dashboard.css';

const Card = ({ 
  children, 
  title, 
  subtitle,
  icon,
  action,
  variant = 'default',
  className = '',
  ...props 
}) => {
  const variants = {
    default: 'dashboard-card',
    stats: 'stats-card',
    table: 'table-container',
    gradient: 'bg-white border border-slate-200 shadow-sm'
  };

  const classes = `${variants[variant]} ${className}`;

  return (
    <div className={classes} {...props}>
      {(title || subtitle || icon || action) && (
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            {icon && (
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-slate-900">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && (
            <div>
              {action}
            </div>
          )}
        </div>
      )}
      
      <div className={title || subtitle || icon || action ? 'p-6' : ''}>
        {children}
      </div>
    </div>
  );
};

export default Card;