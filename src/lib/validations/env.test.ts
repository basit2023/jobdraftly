import { describe, expect, it } from "vitest";

import { databaseUrlSchema } from "./env";

describe("databaseUrlSchema", () => {
  it("accepts a MySQL connection URL", () => {
    expect(
      databaseUrlSchema.parse("mysql://user:password@127.0.0.1:3306/jobdraftly"),
    ).toContain("jobdraftly");
  });

  it("rejects non-MySQL URLs", () => {
    expect(() =>
      databaseUrlSchema.parse("postgresql://user:password@127.0.0.1:5432/jobdraftly"),
    ).toThrow("mysql protocol");
  });
});
