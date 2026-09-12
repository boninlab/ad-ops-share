export type CliCommand =
  | { name: 'login'; configPath?: string }
  | { name: 'run'; configPath: string; dryRun: boolean }
  | { name: 'help' };

export function parseCliArgs(argv: string[]): CliCommand {
  const [command, ...args] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    return { name: 'help' };
  }

  if (command === 'login') {
    return { name: 'login', configPath: readOption(args, '--config') };
  }

  if (command === 'run') {
    const configPath = readOption(args, '--config') ?? 'data/shopping-search-campaign.json';
    return {
      name: 'run',
      configPath,
      dryRun: args.includes('--dry-run')
    };
  }

  throw new Error(`Unknown command: ${command}`);
}

export function printHelp() {
  console.log(`
Usage:
  npm run login
  tsx src/index.ts login [--config data/sample-campaign.json]
  tsx src/index.ts run --config data/sample-campaign.json [--dry-run]

Commands:
  login   Open Chrome and save the logged-in Naver Ads session.
  run     Fill campaign settings from a JSON config.
`);
}

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}
