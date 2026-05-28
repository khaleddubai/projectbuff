import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date relative to now (e.g., "2m ago", "3h ago", "1d ago") */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  }).format(then);
}

/** Format a full date string */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/** Format large numbers (e.g., 1,234,567 -> "1.2M") */
export function formatNumber(num: number): string {
  if (num < 1000) return num.toLocaleString();
  if (num < 1_000_000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1_000_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  return `${(num / 1_000_000_000).toFixed(1)}B`;
}

/** Format bytes to human-readable size */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/** Format duration in ms to human-readable */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/** Truncate string with ellipsis */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

/** Extract a short preview from text */
export function extractPreview(text: string, maxLength = 150): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

/** Get status color class based on status string */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'active':
    case 'healthy':
    case 'online':
      return 'text-emerald-400';
    case 'running':
    case 'pending':
    case 'loading':
      return 'text-aegis-400';
    case 'warning':
    case 'degraded':
      return 'text-amber-400';
    case 'error':
    case 'failed':
    case 'offline':
      return 'text-rose-400';
    default:
      return 'text-surface-400';
  }
}

/** Get status dot class */
export function getStatusDot(status: string): string {
  switch (status) {
    case 'completed':
    case 'active':
    case 'healthy':
    case 'online':
      return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
    case 'running':
    case 'pending':
      return 'bg-aegis-400 shadow-[0_0_6px_rgba(34,211,238,0.5)] animate-pulse';
    case 'warning':
    case 'degraded':
      return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
    case 'error':
    case 'failed':
    case 'offline':
      return 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]';
    default:
      return 'bg-surface-500';
  }
}

/** Class name for pill badge based on status */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
    case 'active':
    case 'healthy':
    case 'online':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'running':
    case 'pending':
      return 'bg-aegis-500/10 text-aegis-400 border-aegis-500/20';
    case 'warning':
    case 'degraded':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'error':
    case 'failed':
    case 'offline':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default:
      return 'bg-surface-800 text-surface-400 border-surface-700';
  }
}

/** Generate a unique ID */
export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2, 11);
}

/** Check if running on client */
export const isClient = typeof window !== 'undefined';
