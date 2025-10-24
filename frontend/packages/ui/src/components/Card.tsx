import * as React from 'react';

export const Card = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={[
    'rounded-xl border border-slate-200 bg-white shadow-sm',
    'p-4 md:p-6',
    className
  ].join(' ')}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <h3 className={[ 'text-slate-900 font-semibold tracking-tight text-base md:text-lg mb-2', className ].join(' ')}>{children}</h3>
);

export const CardSubtle = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <p className={[ 'text-slate-500 text-sm', className ].join(' ')}>{children}</p>
);

