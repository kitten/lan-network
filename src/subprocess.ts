import { lanNetwork } from './index';

async function output() {
  const assignment = await lanNetwork();
  process.stdout.write(JSON.stringify(assignment));
  process.exit(0);
}

output();
