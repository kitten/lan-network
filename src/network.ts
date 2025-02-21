import { networkInterfaces } from 'node:os';
import type { GatewayAssignment, NetworkAssignment } from './types';

export const parseMacStr = (macStr: string): number[] =>
  macStr
    .split(':')
    .slice(0, 16)
    .map(seq => parseInt(seq, 16));

export const parseIpStr = (ipStr: string): number => {
  const addr = ipStr
    .split('.')
    .slice(0, 4)
    .map(seq => parseInt(seq, 10));
  return addr[3] | (addr[2] << 8) | (addr[1] << 16) | (addr[0] << 24);
};

export const toIpStr = (addr: number): string => {
  const MASK = (1 << 8) - 1;
  let ipStr = '';
  ipStr += `${((addr >>> 24) & MASK).toString(10)}.`;
  ipStr += `${((addr >>> 16) & MASK).toString(10)}.`;
  ipStr += `${((addr >>> 8) & MASK).toString(10)}.`;
  ipStr += (addr & MASK).toString(10);
  return ipStr;
};

const getSubnetPriority = (addr: string): number => {
  if (addr.startsWith('192.')) return 5;
  else if (addr.startsWith('172.')) return 4;
  else if (addr.startsWith('10.')) return 3;
  else if (addr.startsWith('100.')) return 2;
  else if (addr.startsWith('127.')) return 1;
  else return 0;
};

export const interfaceAssignments = (): NetworkAssignment[] => {
  const candidates: NetworkAssignment[] = [];
  const interfaces = networkInterfaces();
  for (const iname in interfaces) {
    const assignments = interfaces[iname];
    if (!assignments) continue;
    for (const assignment of assignments) {
      if (assignment.family !== 'IPv4') continue;
      candidates.push({ ...assignment, iname });
    }
  }
  return candidates.sort((a, b) => {
    const priorityA = getSubnetPriority(a.address);
    const priorityB = getSubnetPriority(b.address);
    // Prioritise external interfaces, then sort by priority,
    // when priority is equal, sort by raw IP values
    const sortBy =
      +a.internal - +b.internal ||
      priorityB - priorityA ||
      parseIpStr(b.address) - parseIpStr(a.address);
    return sortBy;
  });
};

export const matchAssignment = (
  candidates: NetworkAssignment[],
  addr: string
): GatewayAssignment | null => {
  const rawAddr = parseIpStr(addr);
  for (const candidate of candidates) {
    const candidateAddr = parseIpStr(candidate.address);
    if (rawAddr === candidateAddr) return { ...candidate, gateway: null };
    const mask = parseIpStr(candidate.netmask);
    if ((rawAddr & mask) === (candidateAddr & mask))
      return { ...candidate, gateway: addr };
  }
  return null;
};
