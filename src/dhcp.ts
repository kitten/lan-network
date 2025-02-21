import { randomBytes } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { parseIpStr, toIpStr, parseMacStr } from './network';
import type { NetworkAssignment } from './types';

class DHCPTimeoutError extends TypeError {
  code = 'ETIMEDOUT';
}

const computeBroadcastAddress = (assignment: NetworkAssignment) => {
  const address = parseIpStr(assignment.address);
  const netmask = parseIpStr(assignment.netmask);
  return toIpStr(address | ~netmask);
};

const dhcpDiscoverPacket = (macStr: string) => {
  const MAC_ADDRESS = new Uint8Array(16);
  MAC_ADDRESS.set(parseMacStr(macStr));
  const packet = new Uint8Array(244);
  const XID = randomBytes(4);
  packet[0] = 1; // op = request
  packet[1] = 1; // hw_type = ethernet
  packet[2] = 6; // hw_len = ethernet
  packet[3] = 0; // hops = 0
  packet.set(XID, 4);
  // elapsed = 0 seconds [2 bytes]
  packet[10] = 0x80; // flags = broadcast discovery [2 bytes]
  // client IP = null [4 bytes]
  // own IP = null [4 bytes]
  // server IP = null [4 bytes]
  // gateway IP = null [4 bytes]
  packet.set(MAC_ADDRESS, 28);
  // sname = null [64 bytes]
  // boot file = null [128 bytes]
  packet.set([0x63, 0x82, 0x53, 0x63], 236); // Magic cookie
  packet.set([0x35, 0x01, 0x01, 0xff], 240); // Trailer
  return packet;
};

const DHCP_TIMEOUT = 250;
const DHCP_CLIENT_PORT = 68;
const DHCP_SERVER_PORT = 67;

export const dhcpDiscover = (
  assignment: NetworkAssignment
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const broadcastAddress = computeBroadcastAddress(assignment);
    const packet = dhcpDiscoverPacket(assignment.mac);
    const timeout = setTimeout(() => {
      reject(
        new DHCPTimeoutError(
          `Received no reply to DHCPDISCOVER in ${DHCP_TIMEOUT}ms`
        )
      );
    }, DHCP_TIMEOUT);
    const socket = createSocket(
      { type: 'udp4', reuseAddr: true },
      (_msg, rinfo) => {
        clearTimeout(timeout);
        resolve(rinfo.address);
        socket.close();
        socket.unref();
      }
    );
    socket.on('error', error => {
      clearTimeout(timeout);
      reject(error);
      socket.close();
      socket.unref();
    });
    socket.bind(DHCP_CLIENT_PORT, () => {
      socket.setBroadcast(true);
      socket.setSendBufferSize(packet.length);
      socket.send(
        packet,
        0,
        packet.length,
        DHCP_SERVER_PORT,
        broadcastAddress,
        error => {
          if (error) reject(error);
        }
      );
    });
  });
};
