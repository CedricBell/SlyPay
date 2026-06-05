/**
 * Full reset: all wallet cards, catalog intel blobs, ad-hoc catalog products.
 * Preserves User accounts; canonical catalog slugs remain with intel fields cleared.
 *
 * Usage:
 *   RESET_CONFIRM=yes npx tsx scripts/reset-all-card-data.ts
 * or interactively type RESET when prompted.
 */
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

async function confirm(): Promise<boolean> {
  if (process.env.RESET_CONFIRM === "yes") return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(
      "Type RESET to wipe all credit cards and catalog intel data: ",
      resolve,
    );
  });
  rl.close();
  return answer.trim() === "RESET";
}

async function main() {
  if (!(await confirm())) {
    console.log("Aborted.");
    return;
  }

  execSync(
    "npx prisma db execute --file prisma/reset-card-pipeline-full.sql --schema prisma/schema.prisma",
    { stdio: "inherit", cwd: process.cwd() },
  );

  console.log("Reset complete. Run: npx tsx scripts/sync-catalog.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
