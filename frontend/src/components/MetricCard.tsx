import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: 'teal' | 'blue' | 'emerald' | 'amber' | 'purple';
  id?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'teal',
  id,
}) => {
  const accentClasses = {
    teal: 'text-teal-600 bg-teal-50 border-teal-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
  };

  return (
    <div
      id={id}
      className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-card hover:shadow-card-hover transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${accentClasses[accentColor]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900 mb-1 tabular-nums">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500 flex items-center gap-1 font-medium">
          {subtitle}
        </div>
      )}
    </div>
  );
};
