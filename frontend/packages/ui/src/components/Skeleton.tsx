import * as React from 'react';

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={['animate-pulse rounded-lg bg-slate-200/70', className].join(' ')} />
);

