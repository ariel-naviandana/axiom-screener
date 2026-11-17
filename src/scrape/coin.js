// src/scrape/coin.js — proses satu coin: Axiom lalu GMGN
const { readAxiom } = require('./axiom');
const { readGmgn } = require('./gmgn');
const { EMPTY_MIG } = require('./migcandle');

// Baris kosong (-1 / -) untuk data yang tidak terbaca
const EMPTY = {
    aTop10: -1, aDev: -1, aSnipers: -1, aInsiders: -1, aBundlers: -1, aLpBurned: -1, aHolders: -1,
    aProTraders: -1, aDexPaid: '-', gTop10: -1, gDev: -1, gHolders: -1, gSnipers: -1, gInsiders: -1,
    gPhishing: -1, gBundler: -1, gDexPaid: '-', gNoMint: '-', gNoBlacklist: '-', gBurnt: -1, gRug: -1,
    aMcap: -1,
    ...EMPTY_MIG,
};

// Proses satu coin: baca Axiom lalu GMGN, selalu keduanya (filter dinilai di n8n).
// Status: OK / AXIOM_GAGAL / GMGN_GAGAL / ERROR. row['9'] (aHolders) = holder dari tab "Holders (n)",
// cadangan dari kotak statistik.
// onStep (opsional): dipanggil dengan nama langkah ('Axiom' / 'GMGN') untuk log progres
async function scrapeCoin(page, pw, coin, onStep = () => {}) {
    const base = { ...EMPTY, name: coin.name, ca: coin.ca };
    try {
        onStep('Axiom');
        const ax = await readAxiom(page, pw, coin.ca);
        onStep('GMGN');
        const gm = await readGmgn(page, pw, coin.ca);
        const axOk = ax.ok && ax.holders >= 0;
        const status = !axOk ? 'AXIOM_GAGAL' : (gm.ok ? 'OK' : 'GMGN_GAGAL');
        const { ok: _a, holders, ...axData } = ax;
        const { ok: _g, ...gmData } = gm;
        const row = { ...base, ...axData, ...gmData, status };
        if (holders >= 0) row.aHolders = holders;
        return { row, holders: row.aHolders };
    } catch (e) {
        return { row: { ...base, status: 'ERROR' }, holders: -1, error: e.message };
    }
}

module.exports = { scrapeCoin, EMPTY };
