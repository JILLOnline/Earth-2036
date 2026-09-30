import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

test("every persisted Workgraph evidence artifact is valid JSON", async () => {
  const dir = new URL("../data/runtime/workgraph/evidence/", import.meta.url);
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  assert.ok(files.length > 0);
  for (const file of files) {
    const text = await readFile(new URL(file, dir), "utf8");
    try {
      JSON.parse(text);
    } catch (error) {
      assert.fail(`${file}: ${error.message}`);
    }
  }
});
