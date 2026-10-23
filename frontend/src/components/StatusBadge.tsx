import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'SUCCESS':
    case 'COMPLETED':
    case 'PRIME_A':
      colorClasses = 'bg-teal-50 text-teal-700 border-teal-200/80';
      break;
    case 'STANDARD_B':
    case 'PENDING':
    case 'RECORDED':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200/80';
      break;
    case 'EMERGING_C':
    case 'SETTLED':
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
      break;
    case 'FAILED':
    case 'REVOKED':
    case 'DEFAULTED':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/80';
      break;
    case 'AS_PRESENTED':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200/80';
      break;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${padding} ${colorClasses} tracking-tight`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
