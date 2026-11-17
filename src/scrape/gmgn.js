// src/scrape/gmgn.js — statistik token GMGN
const { num, txt, sleep } = require('../core/util');

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

module.exports = { readGmgn };
