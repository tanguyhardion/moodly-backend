// Verifies types/shared.ts is identical to the frontend's copy.
// Assumes the frontend repo is checked out next to this one (../moodly-frontend),
// or pass its path: `node scripts/check-shared-types.mjs <path-to-frontend>`.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = resolve(process.argv[2] ?? resolve(backendRoot, "../moodly-frontend"));

const backendFile = resolve(backendRoot, "types/shared.ts");
const frontendFile = resolve(frontendRoot, "app/types/shared.ts");

const normalize = (text) => text.replace(/\r\n/g, "\n");

let frontendText;
try {
  frontendText = readFileSync(frontendFile, "utf8");
} catch {
  console.error(`Could not read ${frontendFile}. Pass the frontend repo path as an argument.`);
  process.exit(2);
}

if (normalize(readFileSync(backendFile, "utf8")) !== normalize(frontendText)) {
  console.error(`Shared types are out of sync:\n  ${backendFile}\n  ${frontendFile}`);
  process.exit(1);
}

console.log("Shared types are in sync.");
