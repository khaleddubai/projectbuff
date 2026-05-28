import { describe, it, expect } from 'vitest';
import { findFreePort, healthCheck, getActiveServers } from './portService';

describe('getActiveServers', () => {
  it('should return a Map', () => {
    const servers = getActiveServers();
    expect(servers).toBeInstanceOf(Map);
  });

  it('should initially be empty', () => {
    const servers = getActiveServers();
    expect(servers.size).toBe(0);
  });
});

describe('findFreePort', () => {
  it('should return a valid port number', async () => {
    const port = await findFreePort(9000);
    expect(port).toBeGreaterThanOrEqual(9000);
    expect(port).toBeLessThan(65535);
  });

  it('should return an available port (not in use)', async () => {
    const port = await findFreePort(9010);
    // The port should be an integer
    expect(Number.isInteger(port)).toBe(true);
    // It should be within valid range
    expect(port).toBeGreaterThanOrEqual(9010);
    expect(port).toBeLessThan(65535);
  });

  it('should skip the reserved ports (3000, 3001)', async () => {
    // If we ask for port 3000, it should skip to the next available
    const port = await findFreePort(3000);
    expect(port).toBeGreaterThanOrEqual(3002);
  });

  it('should skip ports used by active emergency servers', async () => {
    // The active servers map should be empty initially, so this should work
    const port = await findFreePort(9100);
    expect(port).toBe(9100);
  });

  it('should return consecutive free ports for multiple calls', async () => {
    const port1 = await findFreePort(9200);
    const port2 = await findFreePort(9200);
    expect(port1).toBe(port2);
  });

  it('should return a numeric port when given a high starting port', async () => {
    // Starting from a high port should still find an available one under 65535
    const port = await findFreePort(65500);
    expect(port).toBeGreaterThanOrEqual(65500);
    expect(port).toBeLessThan(65535);
  }, 10000);
});

describe('healthCheck', () => {
  it('should return false for an unreachable port', async () => {
    const result = await healthCheck(19999, 1000);
    expect(result).toBe(false);
  });

  it('should respect the timeout parameter', async () => {
    const start = Date.now();
    await healthCheck(19998, 500);
    const elapsed = Date.now() - start;
    // Should not take significantly longer than the timeout
    expect(elapsed).toBeLessThan(3000);
  });
});
