import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KPICardProps {
  title: string;
  amount: string;
  trend?: string;
  trendUp?: boolean;
  colorType?: 'default' | 'success' | 'warning' | 'error';
  icon: React.ReactNode;
}

export const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  amount, 
  trend, 
  trendUp, 
  colorType = 'default',
  icon 
}) => {
  const iconColors = {
    default: 'bg-primary-container/10 text-primary-container',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-rose-100 text-rose-700'
  };

  return (
    <div className="bg-surface-lowest rounded-2xl p-6 shadow-sm border border-black/5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-widest">{title}</h3>
        <div className={cn("p-2 rounded-lg", iconColors[colorType])}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-display font-bold tabular-nums text-slate-800 tracking-tight">
          {amount}
        </span>
        <span className="text-sm font-bold text-slate-600">MXN</span>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={cn(
            "font-semibold flex items-center", 
            trendUp ? "text-emerald-600" : "text-rose-600"
          )}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
          <span className="text-gray-400 ml-2">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};
