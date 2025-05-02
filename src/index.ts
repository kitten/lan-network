import { spawnSync } from 'child_process';
import { dhcpDiscover } from './dhcp';
import { probeDefaultRoute } from './route';
import {
  DEFAULT_ASSIGNMENT,
  interfaceAssignments,
  matchAssignment,
  isInternal,
} from './network';
import type { GatewayAssignment } from './types';

export async function lanNetwork(): Promise<GatewayAssignment> {
  // Get IPv4 network assignments, sorted by:
  // - external first
  // - LAN-reserved IP range priority
  // - address value
  const assignments = interfaceAssignments();
  if (!assignments.length) {
    // If we have no assignments (which shouldn't ever happen, we make up a loopback interface)
    return DEFAULT_ASSIGNMENT;
  }

  let assignment: GatewayAssignment | null;

  // First, we attempt to probe the default route to a publicly routed IP
  // This will generally fail if there's no route, e.g. if the network is offline
  try {
    const defaultRoute = await probeDefaultRoute();
    // If this route matches a known assignment, return it without a gateway
    if (
      (assignment = matchAssignment(assignments, defaultRoute)) &&
      !isInternal(assignment)
    ) {
      return assignment;
    }
  } catch {
    // Ignore errors, since we have a fallback method
  }

  // Second, attempt to discover a gateway's DHCP network
  // Because without a gateway we won't get a reply, we do this in parallel
  const discoveries = await Promise.allSettled(
    assignments.map(assignment => {
      // For each assignment, we send a DHCPDISCOVER packet to its network mask
      return dhcpDiscover(assignment);
    })
  );
  for (const discovery of discoveries) {
    // The first discovered gateway is returned, if it matches an assignment
    if (discovery.status === 'fulfilled' && discovery.value) {
      const dhcpRoute = discovery.value;
      if ((assignment = matchAssignment(assignments, dhcpRoute))) {
        return assignment;
      }
    }
  }

  // As a fallback, we choose the first assignment, since they're ordered by likely candidates
  // This may return 127.0.0.1, typically as a last resort
  return { ...assignments[0], gateway: null };
}

export function lanNetworkSync(): GatewayAssignment {
  const subprocessPath = require.resolve('lan-network/subprocess');
  const { error, status, stdout } = spawnSync(
    process.execPath,
    [subprocessPath],
    {
      shell: false,
      timeout: 500,
      encoding: 'utf8',
      windowsVerbatimArguments: false,
      windowsHide: true,
    }
  );
  if (status || error) {
    return DEFAULT_ASSIGNMENT;
  } else if (!status && typeof stdout === 'string') {
    const json = JSON.parse(stdout.trim()) as GatewayAssignment;
    return typeof json === 'object' && json && 'address' in json
      ? json
      : DEFAULT_ASSIGNMENT;
  } else {
    return DEFAULT_ASSIGNMENT;
  }
}
