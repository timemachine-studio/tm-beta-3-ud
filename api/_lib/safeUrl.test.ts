import { describe, expect, it } from 'vitest';
import { assertPublicUrl, isPrivateAddress } from './safeUrl.js';

describe('isPrivateAddress (pre-launch-audit.md A.16)', () => {
  it('refuses the ranges a server must never fetch', () => {
    for (const address of [
      '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
      '169.254.169.254', '100.64.0.1', '100.127.255.255', '0.0.0.0',
      '::1', '::', 'fe80::1', 'fd00::1', 'fc00::1',
      '::ffff:127.0.0.1', '::ffff:10.0.0.5', '::ffff:7f00:1', '::ffff:a9fe:a9fe',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it('accepts public addresses', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.63.255.255', '2606:4700::1111', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});

describe('assertPublicUrl', () => {
  it('refuses IPv4-mapped loopback written as an IPv6 literal', async () => {
    await expect(assertPublicUrl('https://[::ffff:127.0.0.1]/', { protocols: ['https:'] })).rejects.toThrow();
    await expect(assertPublicUrl('http://[::ffff:7f00:1]/', { protocols: ['http:', 'https:'] })).rejects.toThrow();
  });
});
