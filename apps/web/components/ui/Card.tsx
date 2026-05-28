'use client';

import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  highlight?: boolean;
}

export function Card({ hover = true, highlight, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'panel',
        hover && 'glass-hover',
        highlight && 'border-aegis-500/30 shadow-[0_0_15px_rgba(34,211,238,0.08)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel-header', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel-body', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 py-3 border-t border-surface-700/30 flex items-center justify-between',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
