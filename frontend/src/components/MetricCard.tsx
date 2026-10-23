import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: 'cyan' | 'emerald' | 'purple' | 'amber' | 'blue';
  id?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'blue',
  id,
}) => {
  const accentBorders = {
    cyan: 'border-l-cyan-500',
    emerald: 'border-l-emerald-500',
    purple: 'border-l-purple-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-brand-500',
  };

  const accentIcons = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    blue: 'text-brand-400 bg-brand-500/10',
  };

  return (
    <div
      id={id}
      className={`glass-panel p-5 rounded-xl border border-white/5 border-l-4 ${accentBorders[accentColor]} transition-all duration-200 hover:border-white/10`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${accentIcons[accentColor]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-white mb-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-400 flex items-center gap-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};
