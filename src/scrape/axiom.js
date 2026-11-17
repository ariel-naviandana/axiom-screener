// src/scrape/axiom.js — detail coin Axiom: 9 statistik, jumlah holder, Global Fees Paid (SOL)
// (+ candle migrasi & volume candle terbaru, lihat migcandle.js)
const { num, mcap, txt, sleep } = require('../core/util');
const { captureChart, readMigCandle } = require('./migcandle');

async function readAxiom(page, pw, ca) {
    const res = { ok: false, holders: -1 };
    // data candle chart ditangkap dari jaringan saat halaman detail dimuat (untuk candle migrasi)
    const waitChart = pw.migCandle ? captureChart(page, ca) : null;
    try {
        await page.goto(`${pw.axiomMemeUrl}${ca}`, { waitUntil: 'domcontentloaded' });
        await page.locator(`a[href*="solscan.io/account/${ca}"]`).first()
            .waitFor({ state: 'attached', timeout: pw.detailWaitMs });
    } catch {
        if (waitChart) await waitChart(0);
        return res;
    }
    await sleep(pw.axiomSettleMs);

    const raw = await page.evaluate(({ mcapXpath, feesXpath }) => {
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
            // Global Fees Paid (header, sebaris dengan market cap): teks induk label tanpa labelnya
            aFees: (() => {
                const lab = [...document.querySelectorAll('span, div')]
                    .find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Global Fees Paid');
                const t = lab && lab.parentElement ? lab.parentElement.textContent.replace('Global Fees Paid', '') : '';
                return /\d/.test(t) ? t : (feesXpath ? x(feesXpath) : '');
            })(),
        };
    }, { mcapXpath: pw.axiomMcapXpath, feesXpath: pw.axiomFeesXpath });

    for (const k of ['aTop10', 'aDev', 'aSnipers', 'aInsiders', 'aBundlers', 'aLpBurned', 'aHolders', 'aProTraders']) {
        res[k] = num(raw[k]);
    }
    res.aDexPaid = txt(raw.aDexPaid);
    res.aMcap = mcap(raw.aMcap);
    res.aFees = num(raw.aFees);
    const m = String(raw.holderTab || '').match(/\((\d[\d,]*)\)/);
    res.holders = m ? parseInt(m[1].replace(/,/g, ''), 10) : res.aHolders;
    res.ok = true;

    // candle migrasi & volume candle terbaru
    if (waitChart) {
        try {
            Object.assign(res, await readMigCandle(pw, ca, await waitChart(pw.migChartWaitMs)));
        } catch (e) {
            res.migNote = `error: ${e.message}`;
        }
    }
    return res;
}

module.exports = { readAxiom };
