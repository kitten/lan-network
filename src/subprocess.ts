import { lanNetwork } from './index';

async function output() {
  const assignment = await lanNetwork({
    noProbe: process.argv.includes('--no-probe'),
    noDhcp: process.argv.includes('--no-dhcp'),
  });
  process.stdout.write(JSON.stringify(assignment));
  process.exit(0);
}

output();
