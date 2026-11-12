import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { rowsFromApiPayload, rowsFromRss } from "./connectors";
import { parseCsv } from "./csv";
import { guessColumnMapping } from "./fields";
import { normalizeImportRow } from "./normalize";

describe("job import parsing", () => {
  it("parses the development-only CSV fixture and guesses its mapping", () => {
    const csv = readFileSync("tests/fixtures/job-import.sample.csv", "utf8");
    const parsed = parseCsv(csv);
    const mapping = guessColumnMapping(parsed.headers);
    const normalized = normalizeImportRow(parsed.rows[0]!, mapping);
    expect(parsed.rows).toHaveLength(1);
    expect(mapping.applicationUrl).toBe("Application URL");
    expect(normalized.data.employmentType).toBe("FULL_TIME");
    expect(normalized.errors).toEqual([]);
  });

  it("accepts root-array and jobs-array API payloads", () => {
    expect(rowsFromApiPayload([{ title: "A" }])).toEqual([{ title: "A" }]);
    expect(rowsFromApiPayload({ jobs: [{ id: 42 }] })).toEqual([{ id: "42" }]);
  });

  it("extracts standard RSS fields without fetching a website", () => {
    const rows = rowsFromRss("<rss><channel><item><title>Engineer</title><description>Role details</description><link>https://example.invalid/job</link><guid>123</guid></item></channel></rss>");
    expect(rows[0]).toMatchObject({ title: "Engineer", source_url: "https://example.invalid/job", source_job_id: "123" });
  });
});

