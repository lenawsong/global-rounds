import * as React from 'react';

interface TabsProps {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={[
            'px-3 py-2 text-sm font-medium -mb-px border-b-2',
            value === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

