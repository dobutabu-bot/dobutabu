import assert from "node:assert/strict";
import test from "node:test";

import { buildAppUrl } from "@/lib/production-env";
import { isAllowedRequestOrigin, shouldEnforceHttpsForPath } from "@/lib/request-origin";

test("same-origin request remains allowed", () => {
  assert.equal(isAllowedRequestOrigin({
    origin: "http://127.0.0.1:3000",
    requestOrigin: "http://127.0.0.1:3000",
    nodeEnv: "development"
  }), true);
});

test("development loopback aliases are allowed only on the same port", () => {
  assert.equal(isAllowedRequestOrigin({
    origin: "http://localhost:3000",
    requestOrigin: "http://127.0.0.1:3000",
    nodeEnv: "development"
  }), true);
  assert.equal(isAllowedRequestOrigin({
    origin: "http://localhost:3010",
    requestOrigin: "http://127.0.0.1:3000",
    nodeEnv: "development"
  }), false);
});

test("cross-site request remains rejected", () => {
  assert.equal(isAllowedRequestOrigin({
    origin: "https://example.invalid",
    requestOrigin: "http://127.0.0.1:3000",
    nodeEnv: "development"
  }), false);
});

test("production does not allow loopback aliases outside the configured allowlist", () => {
  assert.equal(isAllowedRequestOrigin({
    origin: "http://localhost:3000",
    requestOrigin: "http://127.0.0.1:3000",
    nodeEnv: "production"
  }), false);
});

test("Railway internal health probe may use HTTP without weakening other routes", () => {
  assert.equal(shouldEnforceHttpsForPath("/api/health"), false);
  assert.equal(shouldEnforceHttpsForPath("/dashboard"), true);
  assert.equal(shouldEnforceHttpsForPath("/api/documents"), true);
});

test("proxy redirects use the configured public origin", () => {
  assert.equal(
    buildAppUrl("/dashboard", "http://0.0.0.0:3000/api/auth/login", "https://example.up.railway.app").href,
    "https://example.up.railway.app/dashboard"
  );
  assert.equal(
    buildAppUrl("/login", "http://localhost:3000/api/auth/logout", null).href,
    "http://localhost:3000/login"
  );
});
