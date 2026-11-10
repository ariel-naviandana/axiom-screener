// pw/browser.js — satu Chrome (persistent context) untuk screener & watcher
// Pakai Chrome asli (executablePath) + folder profil sendiri supaya sesi login Axiom/GMGN tersimpan.
const { chromium } = require('playwright-core');

const BLOCK_TYPES = new Set(['image', 'media', 'font']);

async function openBrowser(pw) {
    const context = await chromium.launchPersistentContext(pw.userDataDir, {
        executablePath: pw.chromePath,
        headless: !!pw.headless,
        viewport: { width: 1600, height: 1000 },
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
            '--no-first-run',
            '--no-default-browser-check',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    // Hemat CPU/RAM: jangan muat gambar, video, font
    if (pw.blockResources) {
        await context.route('**/*', (route) => (
            BLOCK_TYPES.has(route.request().resourceType()) ? route.abort() : route.continue()
        ));
    }

    context.setDefaultTimeout(pw.timeoutMs);
    context.setDefaultNavigationTimeout(pw.navTimeoutMs);
    return context;
}

module.exports = { openBrowser };
