import { parseCliArgs, printHelp } from './cli.js';
import { loadSelectorConfig, loadShoppingSearchConfig } from './config.js';
import { NaverShoppingSearchAutomation } from './automation/naverShoppingSearch.js';

async function main() {
  const command = parseCliArgs(process.argv.slice(2));

  if (command.name === 'help') {
    printHelp();
    return;
  }

  const campaignConfig = await loadShoppingSearchConfig(command.configPath ?? 'data/shopping-search-campaign.json');
  const selectorConfig = await loadSelectorConfig();
  const automation = new NaverShoppingSearchAutomation(campaignConfig, selectorConfig);

  if (command.name === 'login') {
    await automation.login();
    return;
  }

  await automation.run({ dryRun: command.dryRun });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
