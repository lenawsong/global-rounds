import * as React from 'react';

export const Card = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <div
    className={[
      'rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_24px_60px_-25px_rgba(15,23,42,0.25)] backdrop-blur-sm',
      'p-5 md:p-6',
      className
    ].join(' ')}
  >
    {children}
  </div>
);

export const CardTitle = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <h3 className={[
    'text-slate-900 font-semibold tracking-tight text-lg md:text-xl mb-1',
    className
  ].join(' ')}>
    {children}
  </h3>
);

export const CardSubtle = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <p className={[ 'text-slate-500 text-sm leading-relaxed', className ].join(' ')}>{children}</p>
);

export const CardBody = ({ className = '', children }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={['mt-4', className].join(' ')}>{children}</div>
);
