/**
 * AEGIS — Metrics Middleware
 *
 * Tracks key request metrics for the /metrics endpoint:
 *  - Total request count
 *  - Active requests (concurrent)
 *  - Request duration histogram (bucketed)
 *  - Error count by status code
 *  - Request count by route
 *  - Last request timestamp
 */

import { Request, Response, NextFunction } from 'express';
import { childLogger } from '../utils/logger';

const log = childLogger('metrics');

// =============================================================================
// Metric State
// =============================================================================

interface MetricsState {
  /** Total requests received since startup */
  totalRequests: number;

  /** Currently in-flight requests */
  activeRequests: number;

  /** Duration buckets in milliseconds */
  durationBuckets: Record<string, number>;

  /** Error counts by status code family */
  errorsByStatus: Record<string, number>;

  /** Request count by route path */
  requestsByRoute: Record<string, number>;

  /** Timestamp (epoch ms) of the most recent request */
  lastRequestTime: number;

  /** Server start timestamp (epoch ms) */
  startTime: number;
}

const startTime = Date.now();

const state: MetricsState = {
  totalRequests: 0,
  activeRequests: 0,
  durationBuckets: {
    '0.005': 0,  // 0-5ms
    '0.01': 0,   // 5-10ms
    '0.025': 0,  // 10-25ms
    '0.05': 0,   // 25-50ms
    '0.1': 0,    // 50-100ms
    '0.25': 0,   // 100-250ms
    '0.5': 0,    // 250-500ms
    '1': 0,      // 500-1000ms
    '5': 0,      // 1-5s
    '+inf': 0,   // 5s+
  },
  errorsByStatus: {},
  requestsByRoute: {},
  lastRequestTime: startTime,
  startTime,
};

// =============================================================================
// Bucket Helper
// =============================================================================

const BUCKET_KEYS = ['0.005', '0.01', '0.025', '0.05', '0.1', '0.25', '0.5', '1', '5', '+inf'] as const;
const BUCKET_BOUNDARIES = [5, 10, 25, 50, 100, 250, 500, 1000, 5000];

function recordDuration(durationMs: number): void {
  for (let i = 0; i < BUCKET_BOUNDARIES.length; i++) {
    if (durationMs <= BUCKET_BOUNDARIES[i]) {
      state.durationBuckets[BUCKET_KEYS[i]]++;
      return;
    }
  }
  state.durationBuckets['+inf']++;
}

// =============================================================================
// Middleware
// =============================================================================

/**
 * Express middleware that records per-request metrics.
 * Must be registered early in the middleware stack so it captures all routes.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  state.totalRequests++;
  state.activeRequests++;
  state.lastRequestTime = Date.now();

  const start = Date.now();

  // Capture response finish event — by now req.route is populated
  res.on('finish', () => {
    const duration = Date.now() - start;
    state.activeRequests--;

    recordDuration(duration);

    // Normalise route path: req.route.path for matched routes, req.path for 404s
    const routePath = req.route?.path || req.path || 'unknown';
    state.requestsByRoute[routePath] = (state.requestsByRoute[routePath] || 0) + 1;

    const statusFamily = `${Math.floor(res.statusCode / 100)}xx`;
    if (res.statusCode >= 400) {
      state.errorsByStatus[statusFamily] = (state.errorsByStatus[statusFamily] || 0) + 1;
    }
  });

  next();
}

// =============================================================================
// Metrics Endpoint Handler
// =============================================================================

/**
 * Renders Prometheus-compatible metrics as plain text.
 * Serve this at GET /metrics.
 */
export function metricsHandler(_req: Request, res: Response): void {
  const uptime = (Date.now() - state.startTime) / 1000;
  const lines: string[] = [];

  // Helper
  const gauge = (name: string, help: string, value: number, labels?: Record<string, string>): void => {
    lines.push(`# HELP aegis_${name} ${help}`);
    lines.push(`# TYPE aegis_${name} gauge`);
    const labelStr = labels
      ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
      : '';
    lines.push(`aegis_${name}${labelStr} ${value}`);
  };

  const counter = (name: string, help: string, value: number, labels?: Record<string, string>): void => {
    lines.push(`# HELP aegis_${name} ${help}`);
    lines.push(`# TYPE aegis_${name} counter`);
    const labelStr = labels
      ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
      : '';
    lines.push(`aegis_${name}${labelStr} ${value}`);
  };

  // System info
  gauge('uptime_seconds', 'Server uptime in seconds', uptime);
  gauge('start_time_seconds', 'Server start time (Unix epoch)', state.startTime / 1000);
  gauge('last_request_time_seconds', 'Time of the last processed request', state.lastRequestTime / 1000);
  gauge('active_requests', 'Currently in-flight requests', state.activeRequests);

  // Counters
  counter('requests_total', 'Total number of requests processed', state.totalRequests);
  counter('requests_duration_seconds_total', 'Total of all request durations in seconds', Date.now() - state.startTime);

  // Request duration histogram
  lines.push('# HELP aegis_requests_duration_seconds Request duration buckets');
  lines.push('# TYPE aegis_requests_duration_seconds histogram');
  const totalInBuckets = Object.values(state.durationBuckets).reduce((a, b) => a + b, 0);
  for (const [le, count] of Object.entries(state.durationBuckets)) {
    lines.push(`aegis_requests_duration_seconds_bucket{le="${le}"} ${count}`);
  }
  lines.push(`aegis_requests_duration_seconds_count ${totalInBuckets}`);
  lines.push(`aegis_requests_duration_seconds_sum ${(Date.now() - state.startTime) / 1000}`);

  // Errors by status family
  for (const [family, count] of Object.entries(state.errorsByStatus)) {
    counter('errors_total', 'Error count by status family', count, { status_family: family });
  }

  // Requests by route
  for (const [route, count] of Object.entries(state.requestsByRoute)) {
    counter('route_requests_total', 'Request count by route', count, { route });
  }

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines.join('\n') + '\n');

  log.debug({ metricCount: lines.length }, 'Metrics scraped');
}

// =============================================================================
// Expose state for testing
// =============================================================================

/** @visibleForTesting */
export function resetMetrics(): void {
  state.totalRequests = 0;
  state.activeRequests = 0;
  state.durationBuckets = {
    '0.005': 0, '0.01': 0, '0.025': 0, '0.05': 0, '0.1': 0,
    '0.25': 0, '0.5': 0, '1': 0, '5': 0, '+inf': 0,
  };
  state.errorsByStatus = {};
  state.requestsByRoute = {};
  state.lastRequestTime = Date.now();
  // Keep startTime stable
}

export function getMetricsState(): Readonly<MetricsState> {
  return state;
}
