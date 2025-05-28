import puppeteer from "puppeteer";
import { CredentialData } from "./csv-import.js";

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  timeout?: number;
  waitForSelector?: string;
  fullPage?: boolean;
}

export class ScreenshotService {
  private browser?: any;

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
  }

  async captureScreenshot(
    url: string,
    options: ScreenshotOptions = {}
  ): Promise<Buffer> {
    await this.initBrowser();
    const page = await this.browser.newPage();

    try {
      await page.setViewport({
        width: options.width || 1920,
        height: options.height || 1080,
      });

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: options.timeout || 30000,
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      }

      const screenshot = await page.screenshot({
        type: "png",
        fullPage: options.fullPage || false,
      });

      return screenshot as Buffer;
    } finally {
      await page.close();
    }
  }

  async captureCredentialScreenshots(
    credentials: CredentialData[]
  ): Promise<{ id: string; screenshot?: string; error?: string }[]> {
    const results = [];

    for (const credential of credentials) {
      try {
        const screenshot = await this.captureScreenshot(credential.url);
        const base64Screenshot = screenshot.toString("base64");

        results.push({
          id: credential.id,
          screenshot: `data:image/png;base64,${base64Screenshot}`,
        });
      } catch (error) {
        results.push({
          id: credential.id,
          error: error instanceof Error ? error.message : "Screenshot failed",
        });
      }
    }

    return results;
  }

  async findPasswordChangeUrl(url: string): Promise<string | null> {
    await this.initBrowser();
    const page = await this.browser.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle2" });

      // Look for common password change patterns
      const changePasswordSelectors = [
        'a[href*="password"]',
        'a[href*="change"]',
        'a[href*="reset"]',
        'a:contains("Change Password")',
        'a:contains("Reset Password")',
        'a:contains("Account Settings")',
        ".password-change",
        ".change-password",
        "#change-password",
      ];

      for (const selector of changePasswordSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const href = await element.evaluate((el: HTMLAnchorElement) =>
              el.getAttribute("href")
            );
            if (href) {
              return new URL(href, url).href;
            }
          }
        } catch {
          continue;
        }
      }

      return null;
    } catch {
      return null;
    } finally {
      await page.close();
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}
