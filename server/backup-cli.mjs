import { readFile } from "node:fs/promises";
import { backupDatabase, restoreDatabase } from "./backup.mjs";
const [action, source, destination, ledger] = process.argv.slice(2);
const key = process.env.GARDEN_BACKUP_KEY;
if (action === "backup" && source && destination)
  await backupDatabase(source, destination, key);
else if (action === "restore" && source && destination && ledger) {
  const records = (await readFile(ledger, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).id);
  await restoreDatabase(source, destination, key, records);
} else
  throw new Error(
    "用法：backup <database> <new backup> 或 restore <backup> <new database> <latest deletion ledger JSON>",
  );
console.log("Completed successfully");
