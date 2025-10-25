import * as React from 'react';

interface MetricProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: string;
}

export const Metric: React.FC<MetricProps> = ({ label, value, sublabel, trend }) => (
  <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</span>
    <span className="text-2xl font-semibold text-slate-900">{value}</span>
    {sublabel ? <span className="text-sm text-slate-500">{sublabel}</span> : null}
    {trend ? <span className="text-xs font-medium text-blue-600">{trend}</span> : null}
  </div>
);

