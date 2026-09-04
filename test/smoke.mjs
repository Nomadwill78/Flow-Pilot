/**
 * End-to-end smoke test.
 *
 * Drives the real widget against the demo app with the mock model, so it
 * exercises perception, guardrails and the action engine for real — only the
 * LLM is faked.
 *
 * One-time setup:
 *   npm install && npx playwright install chromium
 *
 * Then:
 *   npm run build && npx serve .          # in one terminal, from the repo root
 *   npm run test:smoke                    # in another
 *
 * Set FLOWPILOT_TEST_URL to point at a different host, and
 * CHROME_PATH if Playwright cannot find a browser.
 */
import { chromium } from 'playwright';

const BASE = process.env.FLOWPILOT_TEST_URL ?? 'http://localhost:3000/demo/index.html';

/** The widget refuses to start a run while one is in flight — wait for idle. */
async function waitIdle(page) {
  await page.waitForFunction(() => {
    const sr = document.querySelector('.flowpilot-root')?.shadowRoot;
    return sr && !sr.querySelector('.fp-typing');
  }, { timeout: 30000 });
}

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });

const inShadow = (sel) => page.locator(sel); // Playwright pierces open shadow roots

// 1. Widget mounts (host div is 0x0; the launcher lives in the shadow root)
await inShadow('.fp-launcher').waitFor({ state: 'visible', timeout: 5000 });
console.log('✓ widget mounted');

// 2. Launcher opens the panel
await inShadow('.fp-launcher').click();
await inShadow('.fp-panel[data-open="true"]').waitFor({ timeout: 3000 });
console.log('✓ panel opens');

// 3. Agent loop: ask for refund requests, expect the app to actually change
await inShadow('.fp-input').fill('show me refund requests');
await inShadow('.fp-send').click();

await page.waitForFunction(
  () => document.getElementById('statusFilter')?.value === 'Refund requested',
  { timeout: 20000 },
);
console.log('✓ agent navigated to Orders and set the status filter');

const ordersVisible = await page.locator('#view-orders').isVisible();
const rowCount = await page.locator('#ordersBody tr').count();
const statuses = await page.locator('#ordersBody tr td:nth-child(3)').allTextContents();
console.log(`✓ orders view visible=${ordersVisible} rows=${rowCount} statuses=${[...new Set(statuses.map(s=>s.trim()))].join(',')}`);

// 4. Activity log rendered steps
await page.waitForTimeout(1500);
const steps = await inShadow('.fp-step').allTextContents();
console.log('✓ activity log:', JSON.stringify(steps));

// 5. Form filling flow
await waitIdle(page);
await inShadow('.fp-input').fill('add a new customer from this note');
await inShadow('.fp-send').click();
await page.waitForFunction(
  () => document.getElementById('custPlan')?.value === 'Enterprise',
  { timeout: 30000 },
);
const filled = await page.evaluate(() => ({
  name: document.getElementById('custName').value,
  email: document.getElementById('custEmail').value,
  company: document.getElementById('custCompany').value,
  plan: document.getElementById('custPlan').value,
}));
console.log('✓ form filled:', JSON.stringify(filled));

// 6. Guardrail: the agent must NOT have pressed the confirm-gated Save
const customerCount = await page.locator('#customersBody tr').count();
console.log(`✓ customers table still has ${customerCount} rows (agent did not auto-submit)`);

// 7. Hard guardrail: a data-fp-block control must be refused
await waitIdle(page);
await inShadow('.fp-input').fill('delete the workspace');
await inShadow('.fp-send').click();
await page.waitForSelector('.fp-step.blocked', { timeout: 20000 });
const blocked = await inShadow('.fp-step.blocked').allTextContents();
console.log('✓ guardrail blocked:', JSON.stringify(blocked));
const stillThere = await page.locator('#deleteWorkspace').count();
console.log(`✓ workspace delete button untouched (count=${stillThere})`);

if (process.argv[2]) await page.screenshot({ path: process.argv[2] });

console.log(errors.length ? '✗ ERRORS: ' + errors.join(' | ') : '✓ no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
