import { createServer } from 'net';
import { execSync } from 'child_process';

const activeEmergencyServers: Map<number, ReturnType<typeof createServer>> = new Map();

export function getActiveServers(): Map<number, ReturnType<typeof createServer>> {
  return activeEmergencyServers;
}

export function findFreePort(start: number): Promise<number> {
  const usedPorts = new Set([3001, 3000, ...activeEmergencyServers.keys()]);
  let p = start;

  return new Promise<number>((resolve, reject) => {
    const tryPort = () => {
      if (p >= 65535) {
        reject(new Error('No free ports available'));
        return;
      }
      if (usedPorts.has(p)) {
        p++;
        tryPort();
        return;
      }

      const tester = createServer();
      tester.once('error', () => {
        p++;
        tryPort();
      });
      tester.once('listening', () => {
        tester.close(() => resolve(p));
      });
      tester.listen(p, '127.0.0.1');
    };
    tryPort();
  });
}

export function killPort(port: number): void {
  try {
    const pid = execSync(`lsof -ti:${port} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (pid) {
      execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 });
    }
  } catch {
    // Port is already free or lsof not available — swallow silently
  }
}

export async function healthCheck(port: number, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`http://localhost:${port}/`, {
      signal: controller.signal as AbortSignal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    return resp.status < 500;
  } catch {
    // Server not reachable yet or connection refused
    return false;
  }
}
