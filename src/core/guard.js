// src/core/guard.js — pengaman supaya siklus tidak macet selamanya
// Perintah Playwright seperti page.evaluate() dan page.close() tidak punya timeout: kalau tab hang
// (renderer freeze / crash), perintah itu menunggu tanpa batas dan siklus tidak pernah selesai.
//   withTimeout : batasi lama sebuah proses, lempar TimeoutError kalau lewat
//   closePage   : tutup tab dengan batas waktu; kalau macet, tab ditinggal (tidak menahan siklus)
//   Progress    : catat langkah yang sedang jalan, untuk log "dilewati" dan pesan macet
const { sleep, log } = require('./util');

class TimeoutError extends Error {
    constructor(label, ms) {
        super(`${label} melewati ${Math.round(ms / 1000)} dtk`);
        this.name = 'TimeoutError';
    }
}

function withTimeout(promise, ms, label) {
    let timer;
    const t = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    });
    return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

async function closePage(page, tag, ms = 10000) {
    if (!page || page.isClosed()) return;
    // Jangan sampai tab ini jadi tab terakhir yang ditutup: Chrome (mode berjendela) ikut keluar
    try {
        const ctx = page.context();
        if (!ctx.pages().some((p) => p !== page && !p.isClosed())) {
            log(tag, 'Tidak ada tab lain, buka tab kosong dulu supaya Chrome tidak ikut tertutup');
            await withTimeout(ctx.newPage(), 15000, 'Buka tab cadangan');
        }
    } catch (e) {
        log(tag, `Gagal buka tab cadangan: ${e.message}`);
    }
    const done = await Promise.race([
        page.close().then(() => true, () => true),
        sleep(ms).then(() => false),
    ]);
    if (!done) log(tag, `Tab tidak bisa ditutup dalam ${Math.round(ms / 1000)} dtk (tab hang), ditinggal`);
}

// Progres siklus: kapan mulai, coin ke berapa, langkah apa (Pulse / Axiom / GMGN)
class Progress {
    constructor() {
        this.reset();
    }

    reset() {
        this.start = null;
        this.i = 0;
        this.n = 0;
        this.name = '';
        this.step = '';
    }

    begin() {
        this.reset();
        this.start = Date.now();
    }

    set(patch) {
        Object.assign(this, patch);
    }

    toString() {
        if (!this.start) return '-';
        const mins = ((Date.now() - this.start) / 60000).toFixed(1);
        const coin = this.n ? `coin ${this.i}/${this.n} ${this.name}` : 'belum ada coin';
        return `siklus jalan ${mins} mnt, ${coin}${this.step ? ` - ${this.step}` : ''}`;
    }
}

module.exports = { withTimeout, closePage, TimeoutError, Progress };
