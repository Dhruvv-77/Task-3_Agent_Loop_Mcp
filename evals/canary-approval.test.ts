import { validateEdit } from "../packages/agent/src/approval.js";

async function main() {
  let blocked = false;

  try {
    await validateEdit(
      "../outside.txt",
      "anything"
    );
  } catch {
    blocked = true;
  }

  if (!blocked) {
    console.error(
      "Canary failed: path traversal was not blocked"
    );
    process.exit(1);
  }

  console.log(
    "Canary passed: approval gate blocked path traversal"
  );
}

main();