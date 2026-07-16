import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

type ViewportSpec = {
  name: string;
  width: number;
  height: number;
};

const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

const ROUTES = [
  "/dashboard",
  "/clients",
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
  { name: "small-desktop", width: 1024, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "iPhone", width: 390, height: 844 },
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
        test.setTimeout(180_000);
        const runtimeErrors: string[] = [];
        const consoleReads: Promise<void>[] = [];
        const failedResponses: string[] = [];
        const failedRequests: string[] = [];
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await ensureAuthenticated(page);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

        // Authentication can legitimately replace the login document. Observe only the
        // target route so those cancelled navigation requests cannot mask UI regressions.
        page.on("console", (message) => {
          if (message.type() !== "error") return;
          consoleReads.push(describeConsoleMessage(message).then((text) => {
            if (!/favicon|ResizeObserver loop/i.test(text)) runtimeErrors.push(text);
          }));
        });
        page.on("pageerror", (error) => runtimeErrors.push(`${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`));
        page.on("response", (response) => {
          if (response.status() >= 400 && !/favicon/i.test(response.url())) {
            failedResponses.push(`${response.status()} ${response.url()}`);
          }
        });
        page.on("requestfailed", (request) => {
          const failure = request.failure()?.errorText ?? "unknown";
          if (!/favicon/i.test(request.url())) {
            failedRequests.push(`${failure} ${request.method()} ${request.url()}`);
          }
        });
        await gotoRoute(page, route);
        await waitForRouteReady(page, route);

        await assertNoHorizontalOverflow(page, route);
        await assertMainLayoutSafety(page);
        await assertTablesContain(page);
        await assertChartsContain(page);
        await assertModalsContain(page);
        await assertIconOnlyControlsHaveLabels(page);
        await assertFormLabelsBound(page);
        await assertFinancialSignIndicators(page);
        await assertKeyboardFocusVisible(page);

        if (viewport.width <= 1024) {
          await assertPrimaryTouchTargets(page, 44);
        }

        if (viewport.width <= 768) {
          await assertMobileNavigationSafeArea(page);
        }

        if (route === "/reconciliation") {
          await assertReconciliationResponsive(page);
        }

        await Promise.all(consoleReads);
        expect(runtimeErrors, `${route} console/runtime hataları`).toEqual([]);
        expect(failedResponses, `${route} başarısız HTTP yanıtları`).toEqual([]);
        expect(failedRequests, `${route} başarısız ağ istekleri`).toEqual([]);
      });
    }
  });
}

async function describeConsoleMessage(message: ConsoleMessage) {
  const values = await Promise.all(message.args().map(async (argument) => {
    return argument.evaluate((value: unknown) => {
      if (value instanceof Error) {
        return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
      }
      try {
        return typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        return String(value);
      }
    }).catch(() => "");
  }));

  const location = message.location();
  const source = location.url ? ` @ ${location.url}:${location.lineNumber}:${location.columnNumber}` : "";
  return `${values.filter(Boolean).join(" ") || message.text()}${source}`;
}

async function ensureAuthenticated(page: Page) {
  await gotoPath(page, "/login");

  // If session is still valid, skip login.
  await maybeWaitForDashboard(page);
  if (isDashboardPage(new URL(page.url()).pathname)) {
    await expect(page.locator("main, [role='main']")).toBeVisible({ timeout: 12_000 });
    return;
  }

  const emailField = page.getByLabel("E-posta");
  const passwordField = page.getByLabel("Şifre");

  const formVisible = await emailField.isVisible().catch(() => false);
  if (!formVisible) {
    throw new Error("Giriş alanı bulunamadı. /login sayfası ulaşılamıyor veya login flow bozulmuş olabilir.");
  }

  await emailField.fill(TEST_EMAIL);
  await passwordField.fill(TEST_PASSWORD);

  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL((url) => isDashboardPage(new URL(url).pathname));

  await waitForRouteReady(page, "/dashboard");
}

async function gotoPath(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 120_000 });
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
    await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 20_000 });
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

async function assertMobileNavigationSafeArea(page: Page) {
  const issues = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>("nav[aria-label='Mobil alt navigasyon']");
    if (!nav) return ["Mobil alt navigasyon bulunamadı"];

    const style = getComputedStyle(nav);
    const rect = nav.getBoundingClientRect();
    const visible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    if (!visible) return [];

    const className = nav.className.toString();
    const hasSafeArea = className.includes("safe-area") || className.includes("env(safe-area-inset-bottom)") || style.paddingBottom !== "0px";
    const out: string[] = [];

    if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.bottom > window.innerHeight + 1) {
      out.push(`Mobil alt nav viewport dışı: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }

    if (!hasSafeArea) {
      out.push("Mobil alt nav safe-area desteği görünmüyor");
    }

    return out;
  });

  expect(issues, `Mobil alt navigasyon safe-area: ${issues.join(" | ")}`).toEqual([]);
}

async function assertKeyboardFocusVisible(page: Page) {
  const issue = await page.evaluate(() => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    active?.blur();
    return null;
  });
  expect(issue).toBeNull();

  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!active || active === document.body) return { found: false, visible: false, label: "focus yok" };

      const rect = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      const className = active.className.toString();
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      const hasFocusStyle =
        style.outlineStyle !== "none" ||
        style.boxShadow !== "none" ||
        className.includes("focus-visible") ||
        className.includes("focus:");

      return {
        found: true,
        visible,
        hasFocusStyle,
        label: active.getAttribute("aria-label") || active.textContent?.trim().slice(0, 40) || active.tagName
      };
    });

    if (result.found && result.visible) {
      expect(result.hasFocusStyle, `Klavye focus görünür değil: ${result.label}`).toBe(true);
      return;
    }
  }

  throw new Error("Klavye ile odaklanabilir görünür kontrol bulunamadı");
}

async function assertFinancialSignIndicators(page: Page) {
  const issues = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("main .amount-positive, main .amount-negative"));
    const out: string[] = [];

    for (const node of nodes) {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text || text.includes("••")) continue;

      if (node.classList.contains("amount-positive") && !text.includes("+")) {
        out.push(`Pozitif tutarda + eksik: ${text}`);
      }

      if (node.classList.contains("amount-negative") && !text.includes("-")) {
        out.push(`Negatif tutarda - eksik: ${text}`);
      }
    }

    return out.slice(0, 20);
  });

  expect(issues, `Green/red finans işaretleri: ${issues.join(" | ")}`).toEqual([]);
}

async function assertFormLabelsBound(page: Page) {
  const issues = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("main label"));
    const out: string[] = [];

    for (const label of labels) {
      const style = getComputedStyle(label);
      const rect = label.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      const text = (label.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;

      const forId = label.getAttribute("for");
      const containsControl = label.querySelector("input, select, textarea, button, [role='combobox']") !== null;
      const targetsExistingControl = forId ? document.getElementById(forId) !== null : false;

      if (!containsControl && !targetsExistingControl) {
        out.push(text.slice(0, 60));
      }
    }

    return out.slice(0, 20);
  });

  expect(issues, `Form label bağlantısı eksik: ${issues.join(" | ")}`).toEqual([]);
}

async function assertIconOnlyControlsHaveLabels(page: Page) {
  const issues = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
    const out: string[] = [];

    for (const control of controls) {
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        continue;
      }

      const text = (control.textContent ?? "").replace(/\s+/g, " ").trim();
      const aria = (control.getAttribute("aria-label") ?? "").trim();
      const title = (control.getAttribute("title") ?? "").trim();
      const hasIcon = control.querySelector("svg") !== null;
      const isIconOnly = hasIcon && text.length === 0;

      if (isIconOnly && aria.length < 2 && title.length < 2) {
        out.push(`${control.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }

    return out.slice(0, 20);
  });

  expect(issues, `Icon-only aria-label eksik: ${issues.join(" | ")}`).toEqual([]);
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
