import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TREATMENT_LOOKBACK_COUNT,
  mergeTreatments,
  normalizeTreatments,
  parseTreatmentQuery,
  queryTreatments
} from "../src/treatments";

afterEach(() => {
  vi.useRealTimers();
});

describe("treatments helpers", () => {
  it("normalizes created_at and mills", () => {
    const [treatment] = normalizeTreatments({
      eventType: "Meal Bolus",
      created_at: "2026-06-10T20:00:00.000Z",
      carbs: 45
    });

    expect(treatment.created_at).toBe("2026-06-10T20:00:00.000Z");
    expect(treatment.mills).toBe(1781121600000);
    expect(treatment.eventType).toBe("Meal Bolus");
  });

  it("uses alternate timestamp fields and preserves extra fields", () => {
    const [treatment] = normalizeTreatments({
      eventType: "Sensor Change",
      mills: 1781121600000,
      custom: "yes"
    });

    expect(treatment.created_at).toBe("2026-06-10T20:00:00.000Z");
    expect(treatment.custom).toBe("yes");
  });

  it("deduplicates by id or fallback identity and sorts descending", () => {
    const merged = mergeTreatments(
      normalizeTreatments([{ eventType: "A", created_at: "2026-06-10T20:00:00.000Z" }]),
      normalizeTreatments([
        { eventType: "A", created_at: "2026-06-10T20:00:00.000Z" },
        { eventType: "B", created_at: "2026-06-10T20:05:00.000Z" }
      ]),
      10
    );

    expect(merged.map((treatment) => treatment.eventType)).toEqual(["B", "A"]);
  });

  it("filters by event type and date range", () => {
    const treatments = normalizeTreatments([
      { eventType: "Carb Correction", created_at: "2026-06-10T20:00:00.000Z", carbs: 12 },
      { eventType: "Correction Bolus", created_at: "2026-06-10T20:05:00.000Z", insulin: 1.2 },
      { eventType: "Site Change", created_at: "2026-06-10T20:10:00.000Z" }
    ]);

    const results = queryTreatments(treatments, {
      count: 5,
      filters: [
        { field: "eventType", operator: "$eq", value: "Correction Bolus" },
        { field: "mills", operator: "$gte", value: "1781121900000" }
      ]
    });

    expect(results).toHaveLength(1);
    expect(results[0].eventType).toBe("Correction Bolus");
  });

  it("parses query params", () => {
    const url = new URL(
      "https://example.com/api/v1/treatments.json?count=12&find[eventType]=Carb%20Correction&find[mills][$gte]=100"
    );

    expect(parseTreatmentQuery(url)).toEqual({
      count: 12,
      filters: [
        { field: "eventType", operator: "$eq", value: "Carb Correction" },
        { field: "mills", operator: "$gte", value: "100" }
      ]
    });
  });

  it("defaults treatments queries to the last 24 hours when no date range is provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));

    const url = new URL("https://example.com/api/v1/treatments.json");

    expect(parseTreatmentQuery(url)).toEqual({
      count: DEFAULT_TREATMENT_LOOKBACK_COUNT,
      filters: [
        { field: "mills", operator: "$gte", value: "1781092800000" }
      ]
    });
  });
});
