import { parse } from "csv-parse/sync";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1_000;

export type RawImportRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: RawImportRow[] } {
  const records = parse(text.replace(/^\uFEFF/, ""), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false,
  }) as RawImportRow[];

  if (!records.length) throw new Error("The CSV contains no data rows.");
  if (records.length > MAX_IMPORT_ROWS) throw new Error(`A CSV import is limited to ${MAX_IMPORT_ROWS.toLocaleString()} rows.`);
  const headers = Object.keys(records[0] ?? {}).map((header) => header.trim()).filter(Boolean);
  if (!headers.length) throw new Error("The CSV header row is missing.");
  if (new Set(headers.map((header) => header.toLocaleLowerCase("en"))).size !== headers.length) {
    throw new Error("CSV column names must be unique.");
  }
  return { headers, rows: records };
}

