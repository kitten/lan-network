export interface NetworkAssignment {
  iname: string;
  address: string;
  netmask: string;
  mac: string;
  internal: boolean;
  cidr: string | null;
  family: 'IPv4';
}

export interface GatewayAssignment extends NetworkAssignment {
  gateway: string | null;
}
