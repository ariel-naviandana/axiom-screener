// pw/scrape.js — baca data Axiom (Pulse + detail) dan GMGN
// Selector sama dengan macro UI.Vision axiom_screener / axiom_watcher.
const { num, mcap, txt, sleep } = require('./util');

const GRID = '//*[@id="platform-layout-container"]/main/div/div[2]/div[3]/section/div/div';
const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// ---------- Axiom Pulse: ambil TOP_N coin teratas kolom Migrated ----------
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

// ---------- Axiom detail coin: 9 statistik + jumlah holder ----------
async function readAxiom(page, pw, ca) {
    const res = { ok: false, holders: -1 };
    try {
        await page.goto(`${pw.axiomMemeUrl}${ca}`, { waitUntil: 'domcontentloaded' });
        await page.locator(`a[href*="solscan.io/account/${ca}"]`).first()
            .waitFor({ state: 'attached', timeout: pw.detailWaitMs });
    } catch {
        return res;
    }
    await sleep(pw.axiomSettleMs);

    const raw = await page.evaluate((mcapXpath) => {
        const x = (q) => {
            const n = document.evaluate(q, document, null, 9, null).singleNodeValue;
            return n ? n.textContent : '';
        };
        const stat = (label) => x(`(//span[normalize-space(text())='${label}']/ancestor::div[2]/div[1]/span)[1]`);
        return {
            aTop10: stat('Top 10 H.'), aDev: stat('Dev H.'), aSnipers: stat('Snipers H.'),
            aInsiders: stat('Insiders'), aBundlers: stat('Bundlers'), aLpBurned: stat('LP Burned'),
            aHolders: stat('Holders'), aProTraders: stat('Pro Traders'), aDexPaid: stat('Dex Paid'),
            holderTab: x(`(//button//span[starts-with(normalize-space(.),'Holders (')])[1]`),
            // coba XPath market cap satu per satu, ambil yang pertama berisi angka
            aMcap: [].concat(mcapXpath).map(x).find((t) => /\d/.test(t)) || '',
        };
    }, pw.axiomMcapXpath);

    for (const k of ['aTop10', 'aDev', 'aSnipers', 'aInsiders', 'aBundlers', 'aLpBurned', 'aHolders', 'aProTraders']) {
        res[k] = num(raw[k]);
    }
    res.aDexPaid = txt(raw.aDexPaid);
    res.aMcap = mcap(raw.aMcap);
    const m = String(raw.holderTab || '').match(/\((\d[\d,]*)\)/);
    res.holders = m ? parseInt(m[1].replace(/,/g, ''), 10) : res.aHolders;
    res.ok = true;
    return res;
}

// ---------- GMGN: statistik token ----------
const GMGN_FIELDS = [
    ['gTop10', 'token-detail-info-top_10', 'info-item-value'],
    ['gDev', 'token-detail-info-dev_hold', 'info-item-value'],
    ['gHolders', 'token-detail-info-holders', 'info-item-value'],
    ['gSnipers', 'token-detail-info-snipers', 'value-node-item'],
    ['gInsiders', 'token-detail-info-rat', 'item-value'],
    ['gPhishing', 'token-detail-info-phishing_hold', 'item-value'],
    ['gBundler', 'token-detail-bundler-badge', 'item-value'],
    ['gDexPaid', 'token-detail-info-dex_pay', 'info-item-value'],
    ['gBurnt', 'token-detail-info-burnt2', 'info-item-value'],
    ['gRug', 'token-detail-info-rug_probabilty', 'info-item-value'],
];

function flag(icon, text) {
    const i = String(icon || '');
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (/success/i.test(i)) return 'OK';
    if (i) return 'BAD:' + i.replace(/^Icon/, '').replace(/16pxRegular$/, '');
    return t ? `BAD:${t}` : '-';
}

async function readGmgn(page, pw, ca) {
    const res = { ok: false };
    try {
        await page.goto(`${pw.gmgnTokenUrl}${ca}`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="token-detail-info-top_10"]').first()
            .waitFor({ state: 'attached', timeout: pw.gmgnWaitMs });
    } catch {
        return res;
    }
    await sleep(pw.gmgnSettleMs); // beri waktu nilai statistik terisi

    const raw = await page.evaluate((fields) => {
        const out = {};
        for (const [key, tid, cls] of fields) {
            const el = document.querySelector(`[data-testid="${tid}"] [class*="${cls}"]`);
            out[key] = el ? el.textContent : '';
        }
        const icon = (tid) => {
            const svg = document.querySelector(`[data-testid="${tid}"] svg`);
            return svg ? svg.getAttribute('data-icon') || '' : '';
        };
        const val = (tid) => {
            const el = document.querySelector(`[data-testid="${tid}"] [class*="info-item-value"]`);
            return el ? el.textContent : '';
        };
        out.mintIcon = icon('token-detail-info-mintable');
        out.mintTxt = val('token-detail-info-mintable');
        out.blIcon = icon('token-detail-info-blacklist');
        out.blTxt = val('token-detail-info-blacklist');
        return out;
    }, GMGN_FIELDS);

    for (const [key] of GMGN_FIELDS) res[key] = key === 'gDexPaid' ? txt(raw[key]) : num(raw[key]);
    res.gNoMint = flag(raw.mintIcon, raw.mintTxt);
    res.gNoBlacklist = flag(raw.blIcon, raw.blTxt);
    res.ok = true;
    return res;
}

// Baris kosong (-1 / -) untuk data yang tidak terbaca
const EMPTY = {
    aTop10: -1, aDev: -1, aSnipers: -1, aInsiders: -1, aBundlers: -1, aLpBurned: -1, aHolders: -1,
    aProTraders: -1, aDexPaid: '-', gTop10: -1, gDev: -1, gHolders: -1, gSnipers: -1, gInsiders: -1,
    gPhishing: -1, gBundler: -1, gDexPaid: '-', gNoMint: '-', gNoBlacklist: '-', gBurnt: -1, gRug: -1,
    aMcap: -1,
};

// Proses satu coin: Axiom -> cek holder -> GMGN. Return baris CSV lengkap.
// failStatus: status kalau holder di bawah minimum (SKIP_HOLDER / DROP_HOLDER)
async function scrapeCoin(page, pw, coin, minHolders, failStatus) {
    const ax = await readAxiom(page, pw, coin.ca);
    let gm = { ok: false };
    let status;
    if (!ax.ok || ax.holders < 0) {
        status = 'AXIOM_GAGAL';
    } else if (ax.holders < minHolders) {
        status = failStatus;
    } else {
        gm = await readGmgn(page, pw, coin.ca);
        status = gm.ok ? 'OK' : 'GMGN_GAGAL';
    }
    const { ok: _a, holders, ...axData } = ax;
    const { ok: _g, ...gmData } = gm;
    return { row: { ...EMPTY, ...axData, ...gmData, name: coin.name, ca: coin.ca, status }, holders };
}

module.exports = { readPulse, readAxiom, readGmgn, scrapeCoin };
