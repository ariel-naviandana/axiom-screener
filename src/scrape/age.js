// src/scrape/age.js — waktu coin DIBUAT (Created), bukan waktu migrasi
// Label hijau di header detail Axiom (mis. "4m") = umur sejak MIGRATED, bukan Created.
// Waktu Created hanya ada di tooltip saat label di-hover:
//   Created 23m ago · Migrated 4m ago
//   Created    Nov 21, 2026, 10:13:33 AM
//   Migrated   Nov 21, 2026, 10:32:27 AM
// Yang dibaca: baris Created -> ditulis tanggal & jam WIB (yyyy-MM-dd HH:mm:ss).
// Cadangan kalau baris tanggal tidak terbaca: "Created 23m ago" -> sekarang - 23m (perkiraan).
const { sleep, nowTs } = require('../core/util');

const CREATED_ABS = /Created\s+([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/i;
const CREATED_REL = /Created\s+(\d+)\s?(s|m|h|d|w|mo|y)\s+ago/i;
const UNIT_MS = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, mo: 2592e6, y: 31536e6 };

// Tandai elemen yang di-hover: #pair-name-tooltip > span (label hijau), cadangan: teks hijau berbentuk umur
async function tagLabel(page) {
    return page.evaluate(() => {
        document.querySelectorAll('[data-age-probe]').forEach((e) => e.removeAttribute('data-age-probe'));
        const ok = (t) => /^\d+\s?(s|m|h|d|w|mo|y)$/i.test(t);
        const leaf = (root) => {
            if (!root) return null;
            const all = [root, ...root.querySelectorAll('*')];
            return all.find((e) => e.childElementCount === 0 && ok(e.textContent.trim())) || null;
        };
        let el = leaf(document.querySelector('#pair-name-tooltip > span'));
        if (!el) {
            for (const g of document.querySelectorAll('span.text-primaryGreen')) {
                const r = g.getBoundingClientRect();
                if (r.width > 0 && r.top >= 0 && r.top < 400 && (el = leaf(g))) break;
            }
        }
        if (!el) return '';
        el.setAttribute('data-age-probe', '1');
        return el.textContent.trim();
    });
}

// Return { createdAt: '2026-11-21 10:13:33' | '-', note }. Tidak pernah melempar error: umur bukan syarat status OK.
async function readAge(page) {
    try {
        const label = await tagLabel(page);
        if (!label) return { createdAt: '-', note: 'label umur tidak ditemukan' };

        let text = '';
        for (let attempt = 0; attempt < 2 && !/Created/i.test(text); attempt++) {
            await page.locator('[data-age-probe="1"]').first().hover({ timeout: 3000, force: true });
            for (let w = 0; w < 6 && !/Created/i.test(text); w++) { // tooltip muncul sesaat setelah hover
                await sleep(350);
                text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
            }
            if (!/Created/i.test(text)) await page.mouse.move(0, 0).catch(() => {});
        }
        await page.mouse.move(0, 0).catch(() => {});

        const abs = text.match(CREATED_ABS);
        if (abs) {
            const ms = Date.parse(abs[1]);
            if (Number.isFinite(ms)) return { createdAt: nowTs(new Date(ms)), note: '' };
        }
        const rel = text.match(CREATED_REL);
        if (rel) {
            const ms = Date.now() - parseInt(rel[1], 10) * UNIT_MS[rel[2].toLowerCase()];
            return { createdAt: nowTs(new Date(ms)), note: 'perkiraan dari "Created ... ago"' };
        }
        return { createdAt: '-', note: `tooltip Created tidak muncul (label ${label})` };
    } catch (e) {
        return { createdAt: '-', note: `error: ${e.message}` };
    }
}

module.exports = { readAge };
