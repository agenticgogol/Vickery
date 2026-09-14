import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "./session";

describe("session tokens", () => {
  it("round-trips a signed session", async () => {
    const token = await signSessionToken({ userId: "user-owner", role: "owner" });
    const session = await verifySessionToken(token);
    expect(session).toEqual({ userId: "user-owner", role: "owner" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSessionToken({ userId: "user-owner", role: "owner" });
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
