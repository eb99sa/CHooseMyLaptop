// Headless-browser fetcher (Playwright) for Cloudflare-protected stores (Next,
// Best). A real browser executes the "Just a moment…" challenge JS and gets the
// rendered HTML — which plain fetch can't. OFFLINE only (scrape scripts); the
// Next.js app never imports this, and `playwright` is a devDependency.
//
// One browser is launched lazily and reused across pages; call closeBrowser() when
// done (the runner does this at the end).

import { chromium, type Browser, type BrowserContext } from "playwright";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

let browser: Browser | null = null;
let ctx: BrowserContext | null = null;

async function context(): Promise<BrowserContext> {
  if (ctx) return ctx;
  // Headed + automation-flags hidden: Cloudflare's managed challenge loops forever on
  // detectable headless Chrome, but waves a "real-looking" browser through. HEADFUL=0
  // forces headless (faster, but more pages get stuck on the challenge).
  const headless = process.env.HEADFUL === "0";
  browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  ctx = await browser.newContext({ userAgent: UA, locale: "en-US", viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return ctx;
}

/**
 * Navigate with a real browser and return the rendered HTML. Waits out a
 * Cloudflare interstitial if one appears; returns null if it never clears or on error.
 */
export async function fetchRendered(url: string, settleMs = 1200): Promise<string | null> {
  let page;
  try {
    page = await (await context()).newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    let title = await page.title();
    for (let i = 0; i < 8 && /just a moment|attention required|verifying you/i.test(title); i++) {
      await page.waitForTimeout(2000);
      title = await page.title();
    }
    if (/just a moment|attention required/i.test(title)) return null; // never cleared
    if (settleMs) await page.waitForTimeout(settleMs);
    return await page.content();
  } catch (e) {
    console.warn("[headless]", (e as Error).message);
    return null;
  } finally {
    await page?.close().catch(() => {});
  }
}

export async function closeBrowser(): Promise<void> {
  await ctx?.close().catch(() => {});
  ctx = null;
  await browser?.close().catch(() => {});
  browser = null;
}
