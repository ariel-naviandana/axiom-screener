// src/jobs/cycle.js — bagian bersama screener & watcher: tab, batas waktu, tulis CSV
// Pengaman macet (guard.js):
//   - satu coin dibatasi coinTimeoutMs -> status TIMEOUT, tab diganti baru, lanjut coin berikutnya
//   - tab crash -> diganti tab baru di coin berikutnya
//   - satu siklus dibatasi (screenerTimeoutMs / watcher: jumlah coin x coinTimeoutMs + extra)
//     -> siklus dihentikan paksa, tab ditutup, jadwal berikutnya bisa jalan
//   - tab yang tidak bisa ditutup (hang) ditinggal, tidak menahan siklus
const { scrapeCoin, EMPTY } = require('../scrape/coin');
const { nowTs, log } = require('../core/util');
const { appendRow } = require('../core/csv');
const { withTimeout, closePage, TimeoutError, Progress } = require('../core/guard');

// progres siklus yang sedang jalan (dipakai di log "dilewati")
const progress = { SCREENER: new Progress(), WATCHER: new Progress() };

// Tab untuk satu siklus. Kalau crash / ada perintah yang menggantung, tab diganti baru.
class Tab {
    constructor(context, tag) {
        this.context = context;
        this.tag = tag;
        this.page = null;
        this.broken = false;
    }

    async get() {
        if (this.page && !this.broken && !this.page.isClosed()) return this.page;
        if (this.page) {
            await closePage(this.page, this.tag);
            log(this.tag, 'Tab lama bermasalah, membuka tab baru');
        }
        this.broken = false;
        const page = await withTimeout(this.context.newPage(), 30000, 'Buka tab baru');
        page.on('crash', () => {
            this.broken = true;
            log(this.tag, 'Tab crash, diganti tab baru di coin berikutnya');
        });
        this.page = page;
        return page;
    }

    async close() {
        await closePage(this.page, this.tag);
        this.page = null;
    }
}

// Jalankan satu siklus dengan batas waktu. ctl.aborted = true kalau dihentikan paksa,
// supaya proses lama (kalau ternyata lanjut) berhenti dan tidak menulis ke CSV lagi.
async function guardedCycle(tag, context, maxMs, body) {
    const prog = progress[tag];
    const ctl = { aborted: false, tab: new Tab(context, tag), prog };
    prog.begin();
    try {
        return await withTimeout(body(ctl), maxMs, `Siklus ${tag}`);
    } catch (e) {
        if (!(e instanceof TimeoutError)) throw e;
        ctl.aborted = true;
        log(tag, `SIKLUS MACET (${prog}), batas ${maxMs >= 60000 ? `${(maxMs / 60000).toFixed(1)} mnt` : `${Math.round(maxMs / 1000)} dtk`} terlewati, dihentikan paksa`);
        return null;
    } finally {
        prog.reset();
        await ctl.tab.close();
    }
}

// Satu coin dengan batas waktu. Kalau lewat: status TIMEOUT dan tab diganti baru.
async function scrapeGuarded(ctl, pw, coin) {
    const base = { ...EMPTY, name: coin.name, ca: coin.ca };
    let page;
    try {
        page = await ctl.tab.get();
    } catch (e) {
        return { row: { ...base, status: 'ERROR' }, holders: -1, error: e.message };
    }
    try {
        const onStep = (step) => { if (!ctl.aborted) ctl.prog.set({ step }); };
        const res = await withTimeout(scrapeCoin(page, pw, coin, onStep), pw.coinTimeoutMs, `Coin ${coin.name}`);
        if (res.error && /crash|closed|Target/i.test(res.error)) ctl.tab.broken = true;
        return res;
    } catch (e) {
        ctl.tab.broken = true; // perintah di tab ini masih menggantung, tidak bisa dipakai lagi
        return { row: { ...base, status: 'TIMEOUT' }, holders: -1, error: e.message };
    }
}

// Scrape daftar coin satu per satu, tulis ke CSV
async function scrapeList(tag, ctl, pw, coins, file) {
    for (const [i, coin] of coins.entries()) {
        if (ctl.aborted) return;
        ctl.prog.set({ i: i + 1, n: coins.length, name: coin.name, step: '' });
        const { row, holders, error } = await scrapeGuarded(ctl, pw, coin);
        if (ctl.aborted) return;
        row.ts = nowTs();
        appendRow(file, row);
        log(tag, `${i + 1}/${coins.length} ${coin.name} | holders=${holders} | top10=${row.aTop10} `
            + `bundler=${row.aBundlers} insider=${row.aInsiders} rug=${row.gRug} | mcap=${row.aMcap} | ${row.status}`
            + (pw.migCandle ? ` | mig ${row.migAt} vol=${row.migVol} O=${row.migO} H=${row.migH} L=${row.migL} C=${row.migC}`
                + (row.migNote ? ` [${row.migNote}]` : '') : '')
            + (error ? ` (${error})` : ''));
    }
}

module.exports = { progress, guardedCycle, scrapeList };
