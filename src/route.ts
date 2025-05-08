import { createSocket } from 'dgram';

const PROBE_PORT = 53;
const PROBE_IP = '1.1.1.1';
const NO_ROUTE_IP = '0.0.0.0';

class DefaultRouteError extends TypeError {
  code = 'ECONNABORT';
}

export const probeDefaultRoute = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const socket = createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('error', error => {
      reject(error);
      socket.close();
      socket.unref();
    });
    socket.connect(PROBE_PORT, PROBE_IP, () => {
      const address = socket.address();
      if (address && 'address' in address && address.address !== NO_ROUTE_IP) {
        resolve(address.address);
      } else {
        reject(new DefaultRouteError('No route to host'));
      }
      socket.close();
      socket.unref();
    });
  });
};
