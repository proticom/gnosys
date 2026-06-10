import { describe, it, expect } from "vitest";
import { isApiKeyValidationError } from "../lib/modelValidation.js";

describe("isApiKeyValidationError", () => {
  it("detects xAI-style HTTP 400 incorrect API key messages", () => {
    expect(
      isApiKeyValidationError(
        "HTTP 400: Incorrect API key provided: xa***Lc. You can obtain an API key from https://console.x.ai.",
      ),
    ).toBe(true);
  });

  it("detects HTTP 401 and 403", () => {
    expect(isApiKeyValidationError("HTTP 401: Unauthorized")).toBe(true);
    expect(isApiKeyValidationError("HTTP 403: Forbidden")).toBe(true);
  });

  it("detects common invalid-key phrases", () => {
    expect(isApiKeyValidationError("invalid api key")).toBe(true);
    expect(isApiKeyValidationError("Authentication failed")).toBe(true);
  });

  it("returns false for non-auth failures", () => {
    expect(isApiKeyValidationError("HTTP 404: model not found")).toBe(false);
    expect(isApiKeyValidationError("Request timed out")).toBe(false);
    expect(isApiKeyValidationError(undefined)).toBe(false);
  });
});
