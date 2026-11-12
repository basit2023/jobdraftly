/**
 * Runs the whole job pipeline once and prints a summary:
 *   1. scan approved sources that are due
 *   2. AI-extract new adverts → auto-publish (trusted + confident) or queue for review
 *   3. close jobs whose source advert was removed/cancelled, apply deadline changes
 *   4. expire jobs whose deadline or expiry date has passed
 *
 * Usage: npm run jobs:run-once
 * Useful for testing, or for Windows Task Scheduler if you don't run the worker.
 */
import { db } from "@/lib/db";
import { runDueSourceMonitors } from "@/lib/monitoring/runner";
import { expireDueJobs } from "@/lib/services/job-expiration";

async function main() {
  const monitor = await runDueSourceMonitors(Number(process.env.MONITOR_SOURCE_BATCH_SIZE || 10));
  const expired = await expireDueJobs();
  console.log(JSON.stringify({
    sourcesChecked: monitor.checked,
    scans: monitor.results,
    aiConfigured: monitor.publishing.configured,
    published: monitor.publishing.PUBLISHED,
    waitingForReview: monitor.publishing.PENDING_REVIEW,
    dismissed: monitor.publishing.DISMISSED,
    duplicates: monitor.publishing.DUPLICATE,
    failed: monitor.publishing.FAILED,
    closedBecauseSourceRemoved: monitor.lifecycle.closed,
    deadlinesExtended: monitor.lifecycle.extended,
    expired,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
