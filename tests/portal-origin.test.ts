import test from "node:test";
import assert from "node:assert/strict";
import { portalOrigin } from "../lib/portal-auth";

test("das Kundenportal nutzt seine konfigurierte HTTPS-Adresse vor AUTH_URL", () => {
  const previous = process.env.PORTAL_BASE_URL;
  const previousAuth = process.env.AUTH_URL;
  try {
    process.env.PORTAL_BASE_URL = "https://portal.example.test/";
    process.env.AUTH_URL = "https://erp.example.test";
    assert.equal(portalOrigin().origin, "https://portal.example.test");
    delete process.env.PORTAL_BASE_URL;
    assert.equal(portalOrigin().origin, "https://erp.example.test");
  } finally {
    if (previous === undefined) delete process.env.PORTAL_BASE_URL;
    else process.env.PORTAL_BASE_URL = previous;
    if (previousAuth === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previousAuth;
  }
});
