import path from "node:path";
import process, { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";

const [environmentFile, cliEntry, ...cliArguments] = process.argv.slice(2);

if (!environmentFile || !cliEntry) {
  console.error("Usage: node scripts/run-cli-with-env.mjs <environment-file> <cli-entry> [...arguments]");
  process.exitCode = 2;
} else {
  const resolvedEnvironmentFile = path.resolve(environmentFile);
  const resolvedCliEntry = path.resolve(cliEntry);

  loadEnvFile(resolvedEnvironmentFile);
  process.argv = [process.execPath, resolvedCliEntry, ...cliArguments];
  await import(pathToFileURL(resolvedCliEntry).href);
}
