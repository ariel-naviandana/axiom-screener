// src/scrape/pulse.js — Axiom Pulse: ambil top N coin teratas tabel Migrated
// Selain CA & nama, dari baris Pulse juga dibaca (hanya untuk screener, watcher tidak lewat Pulse):
//   xHandle  akun X/Twitter coin (@...)
//   xType    jenis kartu X di baris: "post" (tweet) / "profile" (profil akun) / "-" kalau tidak ada
//   xText    isi tweet (kartu post) atau bio akun (kartu profile)
//   xUrl     link tweet (kartu post), dari atribut data-href / link ikon X
//   xPostedAt waktu tweet diposting (WIB), dihitung dari id tweet (id X berisi timestamp), bukan dari label "29m"
//   kol      jumlah KOL (ikon piala, kartu hover berisi daftar KOL)
//   holders  jumlah holder (ikon grup), dipakai filter awal screener
const { sleep, mcap, nowTs } = require('../core/util');

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Waktu posting dari id tweet: (id >> 22) + 1288834974657 ms. '-' kalau id tidak ada / tidak masuk akal.
function tweetTime(url) {
    const m = String(url || '').match(/\/status\/(\d+)/);
    if (!m) return '-';
    try {
        const ms = Number((BigInt(m[1]) >> 22n) + 1288834974657n);
        return ms > 1.2e12 && ms < Date.now() + 864e5 ? nowTs(new Date(ms)) : '-';
    } catch {
        return '-';
    }
}

// Isi baris Pulse ke-i (dijalankan di halaman). null kalau baris belum ter-render.
function readRow({ grid, i }) {
    const x = (q) => document.evaluate(q, document, null, 9, null).singleNodeValue;
    const r = x(`${grid}//div[@role='row' and @aria-rowindex='${i}']`);
    if (!r) return null;
    const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    const card = r.querySelector('[data-pulse-token-address]');
    const nameEl = r.querySelector('div.text-textPrimary.truncate[class*="text-[16px]"]');
    const handle = [...r.querySelectorAll('a[href^="https://x.com/"]')].map((a) => clean(a.textContent)).find((t) => t.startsWith('@'));
    const xCard = r.querySelector('[data-pulse-x-card]');
    let xText = '';
    if (xCard) {
        const el = xCard.querySelector('span.line-clamp-2, p.line-clamp-2, [class*="line-clamp"]');
        if (el) {
            // <br> jadi spasi, bukan tergabung
            el.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
            xText = clean(el.textContent);
        }
    }
    // link tweet (hanya kartu post): data-href di kartu, atau link ikon X
    let xUrl = '';
    if (xCard) {
        const urls = [...xCard.querySelectorAll('[data-href], a[href]')]
            .map((e) => e.getAttribute('data-href') || e.getAttribute('href') || '');
        xUrl = (urls.find((u) => /\/status\/\d+/.test(u)) || '').split('?')[0];
    }
    const iconVal = (sel) => {
        const ic = r.querySelector(sel);
        const el = ic && ic.parentElement ? ic.parentElement.querySelector('span') : null;
        return el ? clean(el.textContent) : '';
    };
    const kolIcon = r.querySelector('i.ri-trophy-line');
    const kolEl = kolIcon && kolIcon.parentElement ? kolIcon.parentElement.querySelector('span') : null;
    return {
        ca: card ? card.getAttribute('data-pulse-token-address') : '',
        name: nameEl ? nameEl.textContent : '',
        xHandle: handle || '-',
        xType: xCard ? xCard.getAttribute('data-pulse-x-card') || '-' : '-',
        xState: xCard ? xCard.getAttribute('data-pulse-x-card-state') || '' : 'none',
        xText: xText || '-',
        xUrl: xUrl || '-',
        kol: kolEl ? clean(kolEl.textContent) : '',
        holders: iconVal('i.ri-group-line'),
    };
}

async function readPulse(page, pw, tag) {
    const GRID = pw.pulseGridXpath;
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
            row = await page.evaluate(readRow, { grid: GRID, i });
            if (!row) {
                // list virtual: scroll supaya baris berikutnya ter-render
                await page.evaluate(({ grid, step }) => {
                    const g = document.evaluate(grid, document, null, 9, null).singleNodeValue;
                    if (g) g.scrollTop += step;
                }, { grid: GRID, step: pw.scrollStep });
                await sleep(700);
            }
        }
        // kartu X dimuat belakangan: tunggu sebentar kalau masih loading
        for (let w = 0; w < 4 && row && row.xState && row.xState !== 'loaded' && row.xState !== 'none'; w++) {
            await sleep(500);
            row = (await page.evaluate(readRow, { grid: GRID, i })) || row;
        }
        const ca = String(row?.ca || '').trim();
        if (CA_RE.test(ca) && !coins.some((c) => c.ca === ca)) {
            const kol = parseInt(String(row.kol).replace(/[^\d]/g, ''), 10);
            const holders = mcap(row.holders); // "1.2K" -> 1200
            coins.push({
                ca,
                name: String(row.name || '').replace(/[,\r\n"]/g, ' ').trim(),
                pulse: { xHandle: row.xHandle, xType: row.xType, xText: row.xText, xUrl: row.xUrl, xPostedAt: tweetTime(row.xUrl), kol: Number.isFinite(kol) ? kol : -1, holders },
            });
        }
    }
    return coins;
}

module.exports = { readPulse };
