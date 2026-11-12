import "server-only";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;
const REDACTED_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|database_url)/i;

function clean(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value instanceof Error) return { name: value.name, message: value.message, ...(process.env.NODE_ENV === "development" ? { stack: value.stack } : {}) };
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => clean(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [key, REDACTED_KEY.test(key) ? "[redacted]" : clean(item, depth + 1)]));
  }
  if (typeof value === "string" && value.length > 2_000) return `${value.slice(0, 2_000)}…`;
  return value;
}

function write(level: Level, event: string, fields: Fields = {}) {
  const record = JSON.stringify(clean({ timestamp: new Date().toISOString(), level, service: "jobdraftly", event, ...fields }));
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.log(record);
}

export const logger = {
  debug: (event: string, fields?: Fields) => process.env.NODE_ENV === "development" && write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
