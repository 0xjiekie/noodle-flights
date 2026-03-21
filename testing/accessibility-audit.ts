/**
 * CDP Accessibility Audit Script
 *
 * Uses Chrome DevTools Protocol to capture the accessibility tree
 * and report coverage of aria-labels, roles, and semantic patterns.
 *
 * Usage:
 *   pnpm exec tsx testing/accessibility-audit.ts [URL]
 *
 * Default URL: http://localhost:3000
 */

import { chromium, type Page, type Browser, type CDPSession } from "playwright";

const BASE_URL = process.argv[2] || "http://localhost:3000";

interface AXNode {
  nodeId: string;
  role: { value: string };
  name?: { value: string; sources?: any[] };
  properties?: Array<{ name: string; value: { value: any } }>;
  children?: AXNode[];
  ignored?: boolean;
}

interface AuditResult {
  page: string;
  totalInteractive: number;
  labeled: number;
  unlabeled: string[];
  roles: Record<string, number>;
  landmarks: string[];
  headings: string[];
  issues: string[];
  sampleLabels: string[];
}

async function getAccessibilityTree(page: Page): Promise<AXNode | null> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  try {
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");

    // Build tree from flat node list
    const nodeMap = new Map<string, AXNode>();
    for (const node of nodes) {
      nodeMap.set(node.nodeId, { ...node, children: [] });
    }

    let root: AXNode | null = null;
    for (const node of nodes) {
      const mapped = nodeMap.get(node.nodeId)!;
      if (node.childIds) {
        mapped.children = node.childIds
          .map((id: string) => nodeMap.get(id))
          .filter(Boolean) as AXNode[];
      }
      if (!root && node.role?.value === "RootWebArea") {
        root = mapped;
      }
    }

    return root;
  } finally {
    await cdp.detach();
  }
}

async function auditPage(
  browser: Browser,
  path: string,
  setupFn?: (page: Page) => Promise<void>
): Promise<AuditResult> {
  const page = await browser.newPage();
  const url = `${BASE_URL}${path}`;
  const result: AuditResult = {
    page: path,
    totalInteractive: 0,
    labeled: 0,
    unlabeled: [],
    roles: {},
    landmarks: [],
    headings: [],
    issues: [],
    sampleLabels: [],
  };

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000); // let React hydrate

    if (setupFn) {
      await setupFn(page);
    }

    const root = await getAccessibilityTree(page);
    if (!root) {
      result.issues.push("Could not capture accessibility tree");
      return result;
    }

    const walk = (node: AXNode, depth = 0) => {
      if (node.ignored) return;

      const role = node.role?.value || "";
      const name = node.name?.value || "";

      // Track roles
      if (role && role !== "none" && role !== "generic") {
        result.roles[role] = (result.roles[role] || 0) + 1;
      }

      // Track landmarks
      if (
        [
          "main",
          "navigation",
          "search",
          "banner",
          "contentinfo",
          "complementary",
          "form",
          "region",
        ].includes(role)
      ) {
        result.landmarks.push(`${role}${name ? `: "${name}"` : ""}`);
      }

      // Track headings
      if (role === "heading") {
        const level =
          node.properties?.find((p) => p.name === "level")?.value?.value || "?";
        result.headings.push(`h${level}: "${name || "(empty)"}"`);
      }

      // Check interactive elements for labels
      const interactiveRoles = [
        "button",
        "link",
        "textbox",
        "combobox",
        "checkbox",
        "radio",
        "slider",
        "switch",
        "tab",
        "menuitem",
        "option",
        "gridcell",
      ];

      if (interactiveRoles.includes(role)) {
        result.totalInteractive++;
        if (name && name.trim()) {
          result.labeled++;
          // Sample some labels for review
          if (result.sampleLabels.length < 30) {
            result.sampleLabels.push(`${role}: "${name}"`);
          }
        } else {
          result.unlabeled.push(`${role} at depth ${depth}`);
        }
      }

      // Check for grid pattern
      if (role === "grid" && !name) {
        result.issues.push("Grid without aria-label");
      }
      if (role === "dialog" && !name) {
        result.issues.push("Dialog without aria-label");
      }
      if (role === "listbox" && !name) {
        result.issues.push("Listbox without aria-label");
      }

      if (node.children) {
        for (const child of node.children) {
          walk(child, depth + 1);
        }
      }
    };

    walk(root);
  } catch (err: any) {
    result.issues.push(`Error: ${err.message}`);
  } finally {
    await page.close();
  }

  return result;
}

function printResult(result: AuditResult) {
  const pct =
    result.totalInteractive > 0
      ? ((result.labeled / result.totalInteractive) * 100).toFixed(1)
      : "N/A";

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Page: ${result.page}`);
  console.log(`${"=".repeat(60)}`);
  console.log(
    `Interactive elements: ${result.totalInteractive} total, ${result.labeled} labeled (${pct}%)`
  );

  if (result.landmarks.length > 0) {
    console.log(`\nLandmarks:`);
    result.landmarks.forEach((l) => console.log(`  - ${l}`));
  } else {
    console.log(`\nLandmarks: NONE`);
  }

  if (result.headings.length > 0) {
    console.log(`\nHeadings:`);
    result.headings.forEach((h) => console.log(`  - ${h}`));
  }

  if (result.unlabeled.length > 0) {
    console.log(
      `\nUnlabeled interactive elements (${result.unlabeled.length}):`
    );
    result.unlabeled.slice(0, 15).forEach((u) => console.log(`  - ${u}`));
    if (result.unlabeled.length > 15) {
      console.log(`  ... and ${result.unlabeled.length - 15} more`);
    }
  } else {
    console.log(`\nUnlabeled: NONE (perfect!)`);
  }

  const significantRoles = Object.entries(result.roles)
    .filter(([role]) =>
      [
        "button",
        "textbox",
        "combobox",
        "listbox",
        "option",
        "grid",
        "gridcell",
        "dialog",
        "navigation",
        "main",
        "search",
        "heading",
        "list",
        "listitem",
      ].includes(role)
    )
    .sort(([, a], [, b]) => b - a);

  if (significantRoles.length > 0) {
    console.log(`\nSemantic roles:`);
    significantRoles.forEach(([role, count]) =>
      console.log(`  ${role}: ${count}`)
    );
  }

  if (result.sampleLabels.length > 0) {
    console.log(`\nSample labels (first ${result.sampleLabels.length}):`);
    result.sampleLabels.forEach((l) => console.log(`  - ${l}`));
  }

  if (result.issues.length > 0) {
    console.log(`\nIssues:`);
    result.issues.forEach((i) => console.log(`  ! ${i}`));
  }
}

async function main() {
  console.log(`Accessibility Audit: ${BASE_URL}`);
  console.log(`${"=".repeat(60)}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Homepage
    const home = await auditPage(browser, "/");
    printResult(home);

    // 2. Homepage with calendar open
    const homeCalendar = await auditPage(browser, "/", async (page) => {
      try {
        const depButton = page.locator("[data-date-button]").first();
        await depButton.click({ timeout: 5000 });
        await page.waitForTimeout(800);
      } catch {}
    });
    homeCalendar.page = "/ (calendar open)";
    printResult(homeCalendar);

    // 3. Homepage with location popover
    const homeLocation = await auditPage(browser, "/", async (page) => {
      try {
        const input = page
          .locator('input[placeholder="Where to?"]')
          .first();
        await input.click({ timeout: 5000 });
        await page.waitForTimeout(800);
      } catch {}
    });
    homeLocation.page = "/ (location popover open)";
    printResult(homeLocation);

    // 4. Search results page
    const search = await auditPage(
      browser,
      "/search?tripType=one-way&origin=SFO&destination=JFK&departureDate=2030-06-12&travelClass=economy"
    );
    printResult(search);

    // Summary
    const all = [home, homeCalendar, homeLocation, search];
    const totalInteractive = all.reduce((s, r) => s + r.totalInteractive, 0);
    const totalLabeled = all.reduce((s, r) => s + r.labeled, 0);
    const totalIssues = all.reduce((s, r) => s + r.issues.length, 0);

    console.log(`\n${"=".repeat(60)}`);
    console.log("SUMMARY");
    console.log(`${"=".repeat(60)}`);
    console.log(
      `Total interactive elements across all pages: ${totalInteractive}`
    );
    console.log(
      `Labeled: ${totalLabeled} (${totalInteractive > 0 ? ((totalLabeled / totalInteractive) * 100).toFixed(1) : "N/A"}%)`
    );
    console.log(`Total issues: ${totalIssues}`);

    // Pass/fail
    const labelRate = totalInteractive > 0 ? totalLabeled / totalInteractive : 1;
    if (labelRate >= 0.95 && totalIssues === 0) {
      console.log("\nRESULT: PASS");
    } else if (labelRate >= 0.8) {
      console.log("\nRESULT: PARTIAL PASS (some unlabeled elements)");
    } else {
      console.log("\nRESULT: FAIL (significant gaps)");
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
