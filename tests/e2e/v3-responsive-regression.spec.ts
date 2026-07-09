import { expect, test, type Page } from "@playwright/test";

type ViewportSpec = {
  name: string;
  width: number;
  height: number;
};

const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

const ROUTES = [
  "/dashboard",
  "/cash",
  "/cash/ledger",
  "/documents",
  "/bank-statements",
  "/bank-statements/import",
  "/bank-statements/analysis",
  "/reconciliation",
  "/cash/reconciliation",
  "/capital",
  "/reports",
  "/settings/system-status"
] as const;

const VIEWPORTS: ViewportSpec[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "iPhone", width: 390, height: 844 },
  { name: "Android", width: 412, height: 915 }
];

const ROUTE_ACTION_LABELS = [
  "Yoksay",
  "Gider oluştur",
  "Kasa hareketi",
  "Var olanla eşleştir",
  "Tahsilat oluştur"
];

for (const viewport of VIEWPORTS) {
  test.describe(`V3 responsive regression - ${viewport.name}`, () => {
    for (const route of ROUTES) {
      test(`Route ${route} must stay responsive on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        await ensureAuthenticated(page);
        await gotoRoute(page, route);
        await waitForRouteReady(page, route);

        await assertNoHorizontalOverflow(page, route);
        await assertMainLayoutSafety(page);
        await assertTablesContain(page);
        await assertChartsContain(page);
        await assertModalsContain(page);

        if (viewport.width <= 1024) {
          await assertPrimaryTouchTargets(page, 44);
        }

        if (route === "/reconciliation") {
          await assertReconciliationResponsive(page);
        }
      });
    }
  });
}

async function ensureAuthenticated(page: Page) {
  await gotoPath(page, "/login");

  // If session is still valid, skip login.
  await maybeWaitForDashboard(page);
  if (isDashboardPage(new URL(page.url()).pathname)) {
    await expect(page.locator("main, [role='main']")).toBeVisible({ timeout: 12_000 });
    return;
  }

  const sessionSet = await doLoginApi(page);
  if (sessionSet) {
    await gotoPath(page, "/dashboard");
    await waitForRouteReady(page, "/dashboard");
    return;
  }

  // Fallback: gerçek login formu ile oturum aç
  const emailField = page.getByLabel("E-posta");
  const passwordField = page.getByLabel("Şifre");

  const formVisible = await emailField.isVisible().catch(() => false);
  if (!formVisible) {
    throw new Error("Giriş alanı bulunamadı. /login sayfası ulaşılamıyor veya login flow bozulmuş olabilir.");
  }

  await emailField.fill(TEST_EMAIL);
  await passwordField.fill(TEST_PASSWORD);

  await Promise.all([
    page.waitForURL((url) => {
      const path = new URL(url).pathname;
      return isDashboardPage(path);
    }),
    page.getByRole("button", { name: /giriş yap/i }).click()
  ]);

  await waitForRouteReady(page, "/dashboard");
}

async function doLoginApi(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    form: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    },
    maxRedirects: 0
  });

  if (response.status() !== 303) {
    return false;
  }

  const setCookieHeader = response
    .headersArray()
    .find((item) => item.name.toLowerCase() === "set-cookie")
    ?.value;

  if (!setCookieHeader) {
    return false;
  }

  const firstPair = setCookieHeader.split(",")[0] ?? "";
  const trimmed = firstPair.trim();
  const [rawNameValue] = trimmed.split(";");
  if (!rawNameValue) {
    return false;
  }

  const equalIndex = rawNameValue.indexOf("=");
  if (equalIndex <= 0) {
    return false;
  }

  const cookieName = rawNameValue.substring(0, equalIndex);
  const cookieValue = rawNameValue.substring(equalIndex + 1);

  if (!cookieName || !cookieValue) {
    return false;
  }

  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      url: page.url(),
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  return true;
}

async function gotoPath(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
}

async function gotoRoute(page: Page, route: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await gotoPath(page, route);
      await page.waitForURL((url) => {
        const path = new URL(url).pathname;
        if (route === "/cash") {
          return path === "/cash" || path === "/cash/accounts";
        }

        return path === route;
      }, { timeout: 20_000 });

      return;
    } catch (error) {
      if (attempt === 2 || !isRetryableNavigationError(String(error))) {
        throw error;
      }
      await page.waitForTimeout(500);
    }
  }
}

async function waitForRouteReady(page: Page, route: string) {
  await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("body")).not.toContainText(/Hydration failed|Unhandled Runtime Error|Application error/i, {
    timeout: 5_000
  });

  const path = new URL(page.url()).pathname;

  if (path === "/login") {
    await page.getByTestId("page-ready-login").waitFor({ state: "visible", timeout: 8_000 });
    return;
  }

  if (path === "/install") {
    await page.getByTestId("page-ready-install").waitFor({ state: "visible", timeout: 8_000 });
    return;
  }

  const slug = routeToTestId(route === "/cash" ? "/cash" : path);
  const marker = page.getByTestId(slug);

  if (await marker.count() > 0) {
    await marker.first().waitFor({ state: "visible", timeout: 8_000 });
    return;
  }

  await expect(page.locator("main, [role='main'], #__next")).toBeVisible({ timeout: 10_000 });
}

async function maybeWaitForDashboard(page: Page) {
  if (isDashboardPage(new URL(page.url()).pathname)) {
    await waitForRouteReady(page, "/dashboard").catch(() => undefined);
  }
}

function isDashboardPage(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function routeToTestId(route: string) {
  return `page-ready-${route.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "root"}`;
}

async function assertNoHorizontalOverflow(page: Page, route: string) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return {
      viewportWidth: Math.ceil(window.innerWidth),
      docScrollWidth: Math.ceil(doc.scrollWidth),
      bodyScrollWidth: Math.ceil(body.scrollWidth)
    };
  });

  const maxScroll = Math.max(metrics.docScrollWidth, metrics.bodyScrollWidth);
  expect(
    maxScroll - metrics.viewportWidth,
    `${route} yatay taşma: scrollWidth=${maxScroll}, viewport=${metrics.viewportWidth}`
  ).toBeLessThanOrEqual(1);
}

async function assertMainLayoutSafety(page: Page) {
  const issues = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("main .truncate, main .break-words, main [class*='truncate'], main [class*='break-words']"));
    const problems: string[] = [];

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      const text = (el.textContent ?? "").trim();
      if (!text || rect.width <= 0) continue;

      const style = getComputedStyle(el);
      const hasWrap =
        style.wordBreak === "break-all" ||
        style.wordBreak === "break-word" ||
        style.overflowWrap === "anywhere" ||
        style.whiteSpace === "normal" ||
        style.whiteSpace === "pre-wrap" ||
        (el as HTMLElement).className.toString().includes("line-clamp") ||
        (el as HTMLElement).className.toString().includes("truncate") ||
        (el as HTMLElement).className.toString().includes("break-words");

      if (!hasWrap && (el as HTMLElement).scrollWidth > rect.width + 1) {
        problems.push(`Uzun metin taşma riski: ${text.slice(0, 60)}`);
      }
    }

    return problems.slice(0, 20);
  });

  expect(issues, `Main layout metin taşma kontrolü: ${issues.join(" | ")}`).toEqual([]);
}

async function assertChartsContain(page: Page) {
  const bad = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(".recharts-wrapper, .recharts-responsive-container, [data-testid='chart-frame'], [data-chart='chart']")
    );

    const results: string[] = [];

    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      if (rect.left < -1 || rect.right > window.innerWidth + 1) {
        results.push(`chart overflow: ${(node as HTMLElement).className}`);
      }
    }

    return results.slice(0, 20);
  });

  expect(bad, `Chart taşma: ${bad.join(" | ")}`).toEqual([]);
}

async function assertTablesContain(page: Page) {
  const issues = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table"));
    const out: string[] = [];

    const hasScrollContainer = (el: Element, maxDepth = 8) => {
      let current: HTMLElement | null = el as HTMLElement;
      let depth = 0;

      while (current && depth < maxDepth) {
        const style = getComputedStyle(current);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          return true;
        }

        current = current.parentElement;
        depth += 1;
      }

      return false;
    };

    const isMobile = window.innerWidth <= 768;

    for (const table of tables) {
      const rect = table.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const mobileCard = table.closest(".mobile-card, [data-role='mobile-card'], [data-mobile-card='true'], .md\\:hidden") !== null;
      const inScroll = hasScrollContainer(table);

      if ((isMobile || !isMobile) && rect.width > window.innerWidth + 1 && !inScroll && !mobileCard) {
        const tag = isMobile ? "mobile" : "desktop";
        out.push(`${tag} table taşma: ${Math.round(rect.width)} > ${window.innerWidth}`);
      }
    }

    return out;
  });

  expect(issues, `Tablo taşma: ${issues.join(" | ")}`).toEqual([]);
}

async function assertModalsContain(page: Page) {
  const issues = await page.evaluate(() => {
    const selectors = ["[role='dialog']", "[aria-modal='true']", ".fixed.inset-0", ".fixed.left-0.right-0.top-0.bottom-0"]; 
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")));

    return nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();

        if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
          return false;
        }

        return rect.right > window.innerWidth + 1 || rect.left < -1 || rect.bottom > window.innerHeight + 1 || rect.top < -1;
      })
      .map((node) => node.tagName);
  });

  expect(issues, `Açılır pencere taşma: ${issues.join(" | ")}`).toEqual([]);
}

async function assertPrimaryTouchTargets(page: Page, minPx: number) {
  const route = new URL(page.url()).pathname;
  if (route === "/bank-statements" || route === "/bank-statements/import" || route === "/bank-statements/analysis") {
    await assertBankActionButtons(page, minPx);
  }

  const bad = await page.evaluate((minSize) => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>("main button, main a[role='button'], main [role='button'], main input[type='submit']")
    );

    const failures: string[] = [];

    for (const button of buttons) {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      if (rect.top > window.innerHeight || rect.left > window.innerWidth || rect.bottom < 0 || rect.right < 0) {
        continue;
      }

      const text = (button.textContent ?? "").trim();
      const aria = (button.getAttribute("aria-label") ?? "").trim();
      const className = button.className.toString().toLowerCase();

      const looksLikeAction =
        /action|primary|secondary|touch|toolbar|ekle|oluştur|görüntüle|düzenle|sil|indir|yükle|kapa|kaydet|iptal|gönder|onay|tahsilat|gider|belge|rapor|öde|vazgeç/.test(
          (text + " " + aria + " " + className).toLocaleLowerCase("tr-TR")
        );

      if (!looksLikeAction) {
        continue;
      }

      if (rect.height < minSize || rect.width < minSize) {
        const label = text || aria || "icon/label yok";
        failures.push(`${label} => ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }

      const iconOnly = !(text && text.trim().length > 0);
      if (iconOnly && (!aria || aria.length < 2)) {
        failures.push(`icon-only aria-label eksik: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }

    return failures.slice(0, 40);
  }, minPx);

  expect(bad, `Mobil/tablet için 44px touch hedefi sağlanmıyor: ${bad.join(" | ")}`).toEqual([]);
}

async function assertBankActionButtons(page: Page, minPx: number) {
  for (const label of ROUTE_ACTION_LABELS) {
    const buttons = await page.getByRole("button", { name: new RegExp(label, "i") }).all();

    if (buttons.length === 0) {
      continue;
    }

    const bad = await Promise.all(
      buttons.map(async (button) => {
        const box = await button.boundingBox();
        if (!box || box.width < 1 || box.height < 1) {
          return `${label}: görünür değil`;
        }
        return box.width >= minPx && box.height >= minPx ? null : `${label}: ${Math.round(box.width)}x${Math.round(box.height)}`;
      })
    );

    const filtered = bad.filter(Boolean) as string[];
    expect(filtered, `${label} aksiyonları için minimum hedef boyutu`).toEqual([]);
  }
}

async function assertReconciliationResponsive(page: Page) {
  const checks = await page.evaluate(() => {
    const longTextIssues: string[] = [];
    const actionWrapIssues: string[] = [];
    const isMobile = window.innerWidth <= 768;

    const texts = Array.from(document.querySelectorAll("main td, main th, main [class*='truncate'], main [class*='break-words']"));
    for (const node of texts) {
      const rect = node.getBoundingClientRect();
      const text = (node.textContent ?? "").trim();
      if (!text || rect.width <= 0) continue;
      if (text.length < 16) continue;

      const style = getComputedStyle(node);
      const safeWrap =
        style.wordBreak === "break-all" ||
        style.wordBreak === "break-word" ||
        style.overflowWrap === "anywhere" ||
        style.whiteSpace === "normal" ||
        style.whiteSpace === "pre-wrap" ||
        node.className.toString().includes("line-clamp") ||
        node.className.toString().includes("truncate") ||
        node.className.toString().includes("break-words");

      if (!safeWrap && rect.scrollWidth > rect.width + 2) {
        longTextIssues.push(text.slice(0, 40));
      }
    }

    const actionContainers = Array.from(document.querySelectorAll("main .flex, main .grid"));
    for (const node of actionContainers) {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const className = node.className.toString().toLowerCase();
      const textLike = className.includes("action") || className.includes("toolbar") || className.includes("controls") || className.includes("islemler");
      if (!textLike) continue;

      const style = getComputedStyle(node);
      if (!isMobile && rect.width > window.innerWidth + 1 && style.flexWrap !== "wrap") {
        actionWrapIssues.push(className.slice(0, 80));
      }
      if (isMobile && rect.width > window.innerWidth + 1 && style.flexWrap !== "wrap") {
        actionWrapIssues.push(className.slice(0, 80));
      }
    }

  return {
    longTextIssues: longTextIssues.slice(0, 20),
    actionWrapIssues: actionWrapIssues.slice(0, 20)
  };
  });

  expect(
    checks.longTextIssues,
    `Reconciliation uzun metin taşma: ${checks.longTextIssues.join(" | ")}`
  ).toEqual([]);
  expect(
    checks.actionWrapIssues,
    `Reconciliation aksiyon sığmıyor: ${checks.actionWrapIssues.join(" | ")}`
  ).toEqual([]);
}

function isRetryableNavigationError(message: string) {
  return (
    message.includes("ERR_ABORTED") ||
    message.includes("NS_BINDING_ABORTED") ||
    message.includes("interrupted by another navigation") ||
    message.includes("Execution context was destroyed") ||
    message.includes("frame was detached")
  );
}
