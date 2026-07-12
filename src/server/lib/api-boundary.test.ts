import { describe, expect, it } from "vitest";
import {
  isLoopbackAddress,
  isLoopbackHost,
  resolveRuntimeSecurity,
  safeRequestPath,
  validateRuntimeSecurity,
} from "./api-boundary.js";

describe("local API boundary configuration", () => {
  it("defaults to an exact numeric loopback bind and frontend origin", () => {
    expect(resolveRuntimeSecurity({})).toEqual({
      host: "127.0.0.1",
      frontendOrigin: "http://127.0.0.1:5173",
      mode: "local",
    });
  });

  it.each(["127.0.0.1", "127.20.30.40", "::1"])("accepts numeric loopback bind %s", (host) => {
    expect(resolveRuntimeSecurity({ VELLUM_SERVER_HOST: host }).host).toBe(host);
    expect(isLoopbackAddress(host)).toBe(true);
  });

  it.each(["0.0.0.0", "::", "192.168.1.20", "localhost", "vellum.test"])(
    "rejects non-numeric-loopback bind %s before listen",
    (host) => {
      expect(() => resolveRuntimeSecurity({ VELLUM_SERVER_HOST: host })).toThrow(
        "numeric loopback"
      );
    }
  );

  it.each(["https://vellum.test", "http://192.168.1.20:5173", "null", "*"])(
    "rejects non-loopback or invalid frontend origin %s",
    (origin) => {
      expect(() => resolveRuntimeSecurity({ VELLUM_FRONTEND_ORIGIN: origin })).toThrow();
    }
  );

  it("accepts an exact localhost frontend origin without accepting it as a bind host", () => {
    expect(
      resolveRuntimeSecurity({ VELLUM_FRONTEND_ORIGIN: "http://localhost:5173" }).frontendOrigin
    ).toBe("http://localhost:5173");
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackAddress("localhost")).toBe(false);
  });

  it("rejects a programmatically injected non-loopback security object", () => {
    expect(() =>
      validateRuntimeSecurity({
        host: "0.0.0.0",
        frontendOrigin: "http://127.0.0.1:5173",
        mode: "local",
      })
    ).toThrow("numeric loopback");
  });

  it("never logs the concrete path for an unmatched route", () => {
    expect(safeRequestPath({ path: "/not-found/api_key=sk-1234567890", route: undefined })).toBe(
      "[unmatched route]"
    );
  });
});
