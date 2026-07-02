/**
 * Unit tests for src/lib/ftsQuery.ts — FTS5 MATCH query construction.
 *
 * v5.12.3: multi-word queries were passed raw to FTS5 MATCH, which treats
 * space-separated terms as implicit AND. These helpers quote terms and
 * build explicit AND / OR expressions.
 */

import { describe, expect, it } from "vitest";
import { ftsTerms, ftsAndQuery, ftsOrQuery } from "../lib/ftsQuery.js";

describe("ftsTerms", () => {
  it("splits on whitespace and trims", () => {
    expect(ftsTerms("auth jwt   middleware")).toEqual(["auth", "jwt", "middleware"]);
    expect(ftsTerms("  leading trailing  ")).toEqual(["leading", "trailing"]);
  });

  it("strips quote characters", () => {
    expect(ftsTerms(`"auth" 'jwt'`)).toEqual(["auth", "jwt"]);
    expect(ftsTerms(`don't`)).toEqual(["dont"]);
  });

  it("drops tokens with no letters or digits", () => {
    expect(ftsTerms("auth -- jwt !!")).toEqual(["auth", "jwt"]);
    expect(ftsTerms("--- !!! ***")).toEqual([]);
    expect(ftsTerms("*")).toEqual([]);
  });

  it("returns empty array for empty or whitespace-only input", () => {
    expect(ftsTerms("")).toEqual([]);
    expect(ftsTerms("   ")).toEqual([]);
  });

  it("keeps unicode letters and digits", () => {
    expect(ftsTerms("café münchen v2")).toEqual(["café", "münchen", "v2"]);
  });
});

describe("ftsAndQuery", () => {
  it("quotes each term and joins with spaces (implicit AND)", () => {
    expect(ftsAndQuery(["auth", "jwt"])).toBe(`"auth" "jwt"`);
  });

  it("quotes terms containing FTS5-hostile characters", () => {
    expect(ftsAndQuery(["multi-word", "a:b"])).toBe(`"multi-word" "a:b"`);
    expect(ftsAndQuery(["NOT"])).toBe(`"NOT"`);
  });

  it("preserves trailing * as an FTS5 prefix query", () => {
    expect(ftsAndQuery(["auth*"])).toBe(`"auth"*`);
    expect(ftsAndQuery(["auth**"])).toBe(`"auth"*`);
  });
});

describe("ftsOrQuery", () => {
  it("quotes each term and joins with OR", () => {
    expect(ftsOrQuery(["auth", "jwt", "session"])).toBe(`"auth" OR "jwt" OR "session"`);
  });

  it("single term is just the quoted phrase", () => {
    expect(ftsOrQuery(["auth"])).toBe(`"auth"`);
  });

  it("preserves prefix queries inside OR expressions", () => {
    expect(ftsOrQuery(["auth*", "jwt"])).toBe(`"auth"* OR "jwt"`);
  });
});
