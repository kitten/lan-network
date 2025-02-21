#!/usr/bin/env node

import type { GatewayAssignment } from './types';
import {
  DEFAULT_ASSIGNMENT,
  interfaceAssignments,
  matchAssignment,
} from './network';
import { probeDefaultRoute } from './route';
import { dhcpDiscover } from './dhcp';
import { lanNetwork } from './index';

type Mode = 'help' | 'dhcp' | 'probe' | 'fallback' | 'default';

function help() {
  const output = [
    "Discover the machine's default gateway and local network IP (test utility)",
    '',
    'Usage',
    '  $ lan-network',
    '  $ lan-network --default',
    '',
    'Modes',
    '  --probe     Discover gateway via UDP4 socket to publicly routed address',
    '  --dhcp      Discover gateway via DHCPv4 discover broadcast',
    '  --fallback  Return highest-priority IPv4 network interface assignment',
    '  --default   Try the three above modes in order',
    '  --help      Print help output',
  ].join('\n');
  console.log(output);
}

async function dhcp() {
  const assignments = interfaceAssignments();
  if (!assignments.length) {
    console.error('No available network interface assignments');
    process.exit(1);
  }
  const discoveries = await Promise.allSettled(
    assignments.map(assignment => {
      // For each assignment, we send a DHCPDISCOVER packet to its network mask
      return dhcpDiscover(assignment);
    })
  );
  let assignment: GatewayAssignment | null = null;
  for (const discovery of discoveries) {
    // The first discovered gateway is returned, if it matches an assignment
    if (discovery.status === 'fulfilled' && discovery.value) {
      const dhcpRoute = discovery.value;
      if ((assignment = matchAssignment(assignments, dhcpRoute))) {
        break;
      }
    }
  }
  if (assignment && assignment !== DEFAULT_ASSIGNMENT) {
    console.log(JSON.stringify(assignment, null, 2));
    process.exit(0);
  } else {
    console.error('No DHCP router was discoverable');
    process.exit(1);
  }
}

async function probe() {
  const assignments = interfaceAssignments();
  if (!assignments.length) {
    console.error('No available network interface assignments');
    process.exit(1);
  }
  try {
    const defaultRoute = await probeDefaultRoute();
    const assignment = matchAssignment(assignments, defaultRoute);
    if (assignment && assignment !== DEFAULT_ASSIGNMENT) {
      console.log(JSON.stringify(assignment, null, 2));
      process.exit(0);
    } else {
      console.error('No default gateway or route');
      process.exit(1);
    }
  } catch (error) {
    console.error('No default gateway or route');
    console.error(error);
    process.exit(1);
  }
}

async function fallback() {
  const assignments = interfaceAssignments();
  if (!assignments.length) {
    console.error('No available network interface assignments');
    process.exit(1);
  }
  const assignment = { ...assignments[0], gateway: null };
  console.log(JSON.stringify(assignment, null, 2));
  process.exit(0);
}

async function main() {
  const assignment = await lanNetwork();
  if (assignment !== DEFAULT_ASSIGNMENT) {
    console.log(JSON.stringify(assignment, null, 2));
    process.exit(0);
  } else {
    console.error('No default gateway, route, or DHCP router');
    process.exit(1);
  }
}

function cli() {
  let mode: Mode = 'default';
  parseArgs: for (let i = 1; i < process.argv.length; i++) {
    const arg = process.argv[i].trim().toLowerCase();
    switch (arg) {
      case '-h':
      case '--help':
        mode = 'help';
        break parseArgs;
      case '-d':
      case '--dhcp':
        mode = 'dhcp';
        break;
      case '-p':
      case '--probe':
        mode = 'probe';
        break;
      case '-f':
      case '--fallback':
        mode = 'fallback';
        break;
      default:
        if (arg.startsWith('-')) throw new TypeError(`Invalid flag: ${arg}`);
    }
  }
  switch (mode) {
    case 'help':
      return help();
    case 'dhcp':
      return dhcp();
    case 'probe':
      return probe();
    case 'fallback':
      return fallback();
    case 'default':
      return main();
  }
}

cli();
