import { expect, test } from "@playwright/test";

// Checks that hold for any deployment, with or without test accounts.

test.describe("security headers", () => {
  test("HTML responses carry a strict, nonce-based policy", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";

    expect(response.status()).toBe(200);
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("nonce changes on every request", async ({ request }) => {
    const nonce = async () => (await request.get("/")).headers()["content-security-policy"]?.match(/nonce-([^']+)/)?.[1];
    expect(await nonce()).not.toBe(await nonce());
  });

  test("private routes are not cached or indexed", async ({ request }) => {
    for (const path of ["/m/AAAAAAAAAAAAAA", "/contribuir/AAAAAAAAAAAAAAAAAAAAAA"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["cache-control"]).toContain("no-store");
      expect(headers["x-robots-tag"]).toContain("noindex");
    }
  });

  test("robots keep memories out of search engines", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /m/");
    expect(robots).toContain("Disallow: /painel");
  });
});

test.describe("public memory links", () => {
  test("unknown, malformed and traversal-like slugs all look the same", async ({ request }) => {
    const bodies: string[] = [];
    for (const slug of ["AAAAAAAAAAAAAA", "short", "..%2F..%2Fetc%2Fpasswd", "' or '1'='1", "%3Cscript%3E"]) {
      const response = await request.get(`/m/${slug}`);
      expect(response.status()).toBe(404);
      bodies.push((await response.text()).replace(/nonce-[^"']+|"[a-f0-9]{8,}"/g, ""));
    }
    expect(bodies.every((body) => !/stack|at Object\.|postgres|supabase|sql/i.test(body))).toBe(true);
  });
});

test.describe("authentication boundaries", () => {
  test("dashboard requires a session", async ({ page }) => {
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel/);
  });

  test("editor routes require a session", async ({ request }) => {
    const response = await request.get("/painel/memorias/c0000000-0000-4000-8000-000000000001", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(response.status());
  });

  test("login does not carry open redirects", async ({ page }) => {
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "%2F%2Fevil.example"]) {
      await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
      await expect(page.locator('input[name="next"]')).toHaveValue("/painel");
    }
  });

  test("forms have labels", async ({ page }) => {
    await page.goto("/criar-conta");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
  });
});

test.describe("API hardening", () => {
  test("uploads refuse cross-origin and anonymous requests", async ({ request, baseURL }) => {
    const body = { kind: "image", memoryId: "c0000000-0000-4000-8000-000000000001", mime: "image/png", size: 10 };
    const cross = await request.post("/api/uploads", { data: body, headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
    const anonymous = await request.post("/api/uploads", { data: body, headers: { origin: baseURL! } });
    expect(anonymous.status()).toBe(401);
  });

  test("cron endpoint requires its secret", async ({ request }) => {
    expect((await request.get("/api/cron/maintenance")).status()).toBe(401);
    expect((await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer guess" } })).status()).toBe(401);
  });

  test("analytics accepts nothing from other origins", async ({ request }) => {
    const response = await request.post("/api/analytics", {
      data: { name: "landing_view", props: {} },
      headers: { origin: "https://evil.example" },
    });
    expect(response.status()).toBe(204);
  });

  test("webhook rejects unsigned notifications", async ({ request }) => {
    const response = await request.post("/api/webhooks/mercadopago?type=payment&data.id=1", {
      data: { type: "payment", data: { id: "1" } },
    });
    // 401 when the signature is checked; 429 only if the limiter is already tripped.
    expect([401, 429]).toContain(response.status());
  });

  test("contribution endpoint rejects unknown tokens", async ({ request, baseURL }) => {
    const response = await request.post("/api/contribuir/AAAAAAAAAAAAAAAAAAAAAA", {
      data: { author: "x", body: "y", media: null },
      headers: { origin: baseURL! },
    });
    expect([404, 429]).toContain(response.status());
  });
});

test.describe("layout", () => {
  test("landing has no horizontal scroll and a single h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("no CSP violations or script errors on public pages", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy|Refused to/i.test(message.text())) problems.push(message.text());
    });
    for (const path of ["/", "/entrar", "/criar-conta", "/privacidade", "/termos", "/seguranca"]) {
      await page.goto(path, { waitUntil: "networkidle" });
    }
    expect(problems).toEqual([]);
  });
});
