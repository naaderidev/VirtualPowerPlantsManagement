import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("renders the shared Persian calendar in a portal outside clipping form containers", async () => {
  const source = await readFile(
    join(process.cwd(), "src/components/ui/persian-date-picker.tsx"),
    "utf8",
  );
  assert.match(source, /calendarPosition="bottom-right"\s+portal\s+/);
});
