// src/scrape/pulse.js — Axiom Pulse: ambil top N coin teratas kolom Migrated
const { sleep } = require('../core/util');

const GRID = '//*[@id="platform-layout-container"]/main/div/div[2]/div[3]/section/div/div';
const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function readPulse(page, pw, tag) {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
            await page.goto(pw.axiomPulseUrl, { waitUntil: 'domcontentloaded' });
            await page.locator(`xpath=${GRID}//div[@role='row' and @aria-rowindex='1']//div[@data-pulse-token-address]`)
                .first().waitFor({ state: 'attached', timeout: pw.pulseWaitMs });
            ok = true;
        } catch {
            console.log(`  [${tag}] Pulse belum termuat (percobaan ${attempt})`);
            await sleep(3000);
        }
    }
    if (!ok) return null;

    const coins = [];
    for (let i = 1; i <= pw.topN; i++) {
        let row = null;
        for (let s = 0; s <= 3 && !row; s++) {
            row = await page.evaluate(({ grid, i }) => {
                const x = (q) => document.evaluate(q, document, null, 9, null).singleNodeValue;
                const r = x(`${grid}//div[@role='row' and @aria-rowindex='${i}']`);
                if (!r) return null;
                const card = r.querySelector('[data-pulse-token-address]');
                const nameEl = x(`${grid}//div[@role='row' and @aria-rowindex='${i}']//div[contains(@class,'text-textPrimary') and contains(@class,'truncate') and contains(@class,'text-[16px]')]`);
                return { ca: card ? card.getAttribute('data-pulse-token-address') : '', name: nameEl ? nameEl.textContent : '' };
            }, { grid: GRID, i });
            if (!row) {
                // list virtual: scroll supaya baris berikutnya ter-render
                await page.evaluate(({ grid, step }) => {
                    const g = document.evaluate(grid, document, null, 9, null).singleNodeValue;
                    if (g) g.scrollTop += step;
                }, { grid: GRID, step: pw.scrollStep });
                await sleep(700);
            }
        }
        const ca = String(row?.ca || '').trim();
        if (CA_RE.test(ca) && !coins.some((c) => c.ca === ca)) {
            coins.push({ ca, name: String(row.name || '').replace(/[,\r\n"]/g, ' ').trim() });
        }
    }
    return coins;
}

module.exports = { readPulse };
