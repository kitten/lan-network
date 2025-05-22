import os from 'node:os';
import { vi, describe, it, expect } from 'vitest';
import {
  parseMacStr,
  parseIpStr,
  toIpStr,
  interfaceAssignments,
  matchAssignment,
  isSameSubnet,
} from '../network';

describe(parseMacStr, () => {
  it('parses valid MAC addresses', () => {
    expect(parseMacStr('11:22:33:44:55:66')).toEqual([17, 34, 51, 68, 85, 102]);
  });
});

describe(parseIpStr, () => {
  it('parses valid IP addresses', () => {
    expect(parseIpStr('0.0.0.0').toString(16)).toBe('0');
    expect(parseIpStr('1.1.1.1').toString(16)).toBe('1010101');
    expect(parseIpStr('255.255.255.255').toString(16)).toBe('-1');
    expect(parseIpStr('100.1.2.3').toString(16)).toBe('64010203');
  });
});

describe(toIpStr, () => {
  it.each([['0.0.0.0'], ['1.1.1.1'], ['255.255.255.255'], ['100.1.2.3']])(
    'stringifies parsed IP (%s)',
    addr => {
      expect(toIpStr(parseIpStr(addr))).toBe(addr);
    }
  );
});

describe(isSameSubnet, () => {
  it('returns true for same subnet', () => {
    expect(isSameSubnet('192.168.1.1', '192.168.1.2', '255.255.255.0')).toBe(
      true
    );
  });
  it('returns false for different subnet', () => {
    expect(isSameSubnet('192.168.1.1', '192.168.2.1', '255.255.255.0')).toBe(
      false
    );
  });
});

describe(interfaceAssignments, () => {
  const networkInterfaces = vi
    .spyOn(os, 'networkInterfaces')
    .mockReturnValue([] as any);

  it('returns sorted list of assignments', () => {
    networkInterfaces.mockReturnValueOnce({
      lo0: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '',
        },
      ],
      en1: [
        {
          address: '10.0.0.10',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '',
        },
      ],
      tun2: [
        {
          address: '100.0.0.11',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '',
        },
      ],
    });
    expect(interfaceAssignments()).toMatchInlineSnapshot(`
      [
        {
          "address": "10.0.0.10",
          "cidr": "",
          "family": "IPv4",
          "iname": "en1",
          "internal": false,
          "mac": "00:00:00:00:00:00",
          "netmask": "255.255.255.0",
        },
        {
          "address": "100.0.0.11",
          "cidr": "",
          "family": "IPv4",
          "iname": "tun2",
          "internal": true,
          "mac": "00:00:00:00:00:00",
          "netmask": "255.255.255.0",
        },
        {
          "address": "127.0.0.1",
          "cidr": "",
          "family": "IPv4",
          "iname": "lo0",
          "internal": true,
          "mac": "00:00:00:00:00:00",
          "netmask": "255.0.0.0",
        },
      ]
    `);
  });
});

describe(matchAssignment, () => {
  it('returns matching assignment by address', () => {
    const assignment = {
      iname: 'en0',
      address: '100.0.0.11',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '',
    } as const;
    expect(matchAssignment([assignment], '100.0.0.11')).toEqual({
      ...assignment,
      gateway: null,
    });
  });

  it('returns matching assignment by gateway', () => {
    const assignment = {
      iname: 'en0',
      address: '100.0.0.11',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '',
    } as const;
    expect(matchAssignment([assignment], '100.0.0.1')).toEqual({
      ...assignment,
      gateway: '100.0.0.1',
    });
  });

  it('returns null otherwise', () => {
    const assignment = {
      iname: 'en0',
      address: '10.0.0.1',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '',
    } as const;
    expect(matchAssignment([assignment], '100.0.0.1')).toBe(null);
  });
});
