import { ServerConfig } from '../types/index.js';

// Helper function to parse command line arguments
const getArgValue = (argName: string): string | undefined => {
  const argIndex = process.argv.findIndex((arg) => arg === `--${argName}`);
  // Check if the flag exists and there is a value after it,
  // and that the value is not another flag itself.
  if (
    argIndex > -1 &&
    process.argv.length > argIndex + 1 &&
    !process.argv[argIndex + 1].startsWith('--')
  ) {
    return process.argv[argIndex + 1];
  }
  return undefined;
};

const cliPort = getArgValue('port');
const cliHost = getArgValue('host');
const cliApiPrefix = getArgValue('api-prefix');

export const config: ServerConfig = {
  port: Number(cliPort || process.env.PORT) || 3000,
  host: cliHost || process.env.HOST || '0.0.0.0',
  apiPrefix: cliApiPrefix || process.env.API_PREFIX || '/api',
};
