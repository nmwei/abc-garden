import {deploy} from './deploy-site.mjs';

try {
  await deploy();
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exitCode = 1;
}
