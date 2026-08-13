import { describe, it, expect } from "vitest";
import { validateUrlSyntax } from "../src/browser/urlSafety.js";

describe("validateUrlSyntax", () => {
  it("accepts a normal https URL", () => {
    expect(validateUrlSyntax("https://example.com/product").ok).toBe(true);
  });

  it("rejects non-http(s) schemes", () => {
    expect(validateUrlSyntax("file:///etc/passwd").ok).toBe(false);
    expect(validateUrlSyntax("javascript:alert(1)").ok).toBe(false);
    expect(validateUrlSyntax("data:text/html,hi").ok).toBe(false);
  });

  it("rejects localhost and loopback", () => {
    expect(validateUrlSyntax("http://localhost:3000").ok).toBe(false);
    expect(validateUrlSyntax("http://127.0.0.1").ok).toBe(false);
    expect(validateUrlSyntax("http://[::1]").ok).toBe(false);
  });

  it("rejects private IP ranges", () => {
    expect(validateUrlSyntax("http://10.0.0.5").ok).toBe(false);
    expect(validateUrlSyntax("http://192.168.1.1").ok).toBe(false);
    expect(validateUrlSyntax("http://172.16.0.1").ok).toBe(false);
    expect(validateUrlSyntax("http://169.254.169.254").ok).toBe(false); // cloud metadata endpoint
  });

  it("rejects malformed URLs", () => {
    expect(validateUrlSyntax("not a url").ok).toBe(false);
  });
});
