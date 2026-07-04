import { describe, expect, it } from "vitest";
import {
  clampMaxEntries,
  mergeEntries,
  normalizeEntries,
  parseEntryQuery,
  queryEntries
} from "../src/entries";

describe("entries helpers", () => {
  it("normalizes dateString from date", () => {
    const [entry] = normalizeEntries({ sgv: 143, date: 1781111111111 });
    expect(entry.dateString).toBe(new Date(1781111111111).toISOString());
    expect(entry._id).toBe("1781111111111");
    expect(entry.type).toBe("sgv");
    expect(entry.device).toBe("xDrip");
  });

  it("normalizes date from dateString", () => {
    const [entry] = normalizeEntries({
      sgv: 143,
      dateString: "2026-06-10T20:00:00.000Z"
    });
    expect(entry.date).toBe(1781121600000);
  });

  it("accepts arrays and preserves extra fields", () => {
    const entries = normalizeEntries([
      { sgv: 120, date: 2, custom: "yes" },
      { sgv: 121, date: 1 }
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0].custom).toBe("yes");
  });

  it("deduplicates by id or date and sorts descending", () => {
    const merged = mergeEntries(
      normalizeEntries([{ sgv: 111, date: 1000 }, { sgv: 110, date: 900 }]),
      normalizeEntries([
        { _id: "1000", sgv: 999, date: 1000 },
        { sgv: 120, date: 1200 },
        { sgv: 115, date: 900 }
      ]),
      10
    );

    expect(merged.map((entry) => entry.date)).toEqual([1200, 1000, 900]);
  });

  it("truncates to max entries", () => {
    const merged = mergeEntries(
      [],
      normalizeEntries([
        { sgv: 1, date: 1 },
        { sgv: 2, date: 2 },
        { sgv: 3, date: 3 }
      ]),
      2
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((entry) => entry.date)).toEqual([3, 2]);
  });

  it("filters by count, type and date range", () => {
    const entries = normalizeEntries([
      { sgv: 130, date: 3000, type: "sgv" },
      { sgv: 129, date: 2000, type: "mbg" },
      { sgv: 128, date: 1000, type: "sgv" }
    ]);

    const results = queryEntries(entries, {
      count: 2,
      onlySgv: true,
      currentOnly: false,
      dateGte: 1500
    });

    expect(results.map((entry) => entry.date)).toEqual([3000]);
  });

  it("parses query params", () => {
    const url = new URL(
      "https://example.com/api/v1/entries.json?count=12&find[date][$gte]=100&find[date][$lte]=200"
    );
    expect(parseEntryQuery(url)).toEqual({
      count: 12,
      currentOnly: false,
      onlySgv: false,
      dateGte: 100,
      dateLte: 200
    });
  });

  it("falls back to default max entries", () => {
    expect(clampMaxEntries(undefined)).toBe(2000);
    expect(clampMaxEntries("500")).toBe(500);
  });
});
