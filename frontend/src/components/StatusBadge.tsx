import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'SUCCESS':
    case 'COMPLETED':
    case 'PRIME_A':
      colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      break;
    case 'STANDARD_B':
    case 'PENDING':
    case 'RECORDED':
      colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      break;
    case 'EMERGING_C':
    case 'SETTLED':
      colorClasses = 'bg-brand-500/10 text-brand-400 border-brand-500/30';
      break;
    case 'FAILED':
    case 'REVOKED':
    case 'DEFAULTED':
      colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      break;
    case 'AS_PRESENTED':
      colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      break;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${padding} ${colorClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
