// src/scrape/coin.js — proses satu coin: Axiom lalu GMGN
const { readAxiom } = require('./axiom');
const { readGmgn } = require('./gmgn');
const { EMPTY_MIG } = require('./migcandle');

// Baris kosong (-1 / -) untuk data yang tidak terbaca
const EMPTY = {
    aTop10: -1, aDev: -1, aSnipers: -1, aInsiders: -1, aBundlers: -1, aLpBurned: -1, aHolders: -1,
    aProTraders: -1, aDexPaid: '-', gTop10: -1, gDev: -1, gHolders: -1, gSnipers: -1, gInsiders: -1,
    gPhishing: -1, gBundler: -1, gDexPaid: '-', gNoMint: '-', gNoBlacklist: '-', gBurnt: -1,
    aMcap: -1,
    ...EMPTY_MIG,
    xHandle: '-', xType: '-', xText: '-', kol: -1, // dari baris Pulse (screener saja)
    aFees: -1,
    xPostedAt: '-', xUrl: '-', // tweet: waktu posting & link (kartu post di Pulse, screener saja)
    createdAt: '-', // waktu coin dibuat (detail Axiom)
    skip: '-', // alasan SKIP
};

// Filter awal screener (config filter). Nilai -1 (tidak terbaca) tidak membuat coin di-skip.
function axiomRules(f, ax) {
    const fail = [];
    if (ax.aTop10 >= 0 && ax.aTop10 > f.maxTop10) fail.push(`TOP10 ${ax.aTop10} > ${f.maxTop10}`);
    if (ax.aBundlers >= 0 && ax.aBundlers > f.maxBundler) fail.push(`BUNDLER ${ax.aBundlers} > ${f.maxBundler}`);
    if (ax.aInsiders >= 0 && ax.aInsiders > f.maxInsider) fail.push(`INSIDER ${ax.aInsiders} > ${f.maxInsider}`);
    return fail;
}

// Proses satu coin: baca Axiom lalu GMGN.
// Status: OK / AXIOM_GAGAL / GMGN_GAGAL / ERROR / SKIP. row['9'] (aHolders) = holder dari tab "Holders (n)",
// cadangan dari kotak statistik.
// SKIP (hanya coin dari Pulse = screener, config filter.enabled), urutan cek supaya cepat:
//   1. holder di baris Pulse < minHolders        -> detail Axiom & GMGN tidak dibuka
//   2. volume candle migrasi < minMigVol          -> statistik Axiom lain & GMGN tidak dicatat
//   3. Top 10 / Bundler / Insider melewati batas  -> statistik Axiom dicatat, GMGN tidak dibuka
// onStep (opsional): dipanggil dengan nama langkah ('Axiom' / 'GMGN') untuk log progres
async function scrapeCoin(page, pw, coin, onStep = () => {}) {
    const base = { ...EMPTY, ...(coin.pulse || {}), name: coin.name, ca: coin.ca };
    const f = pw.filter || {};
    const useFilter = !!coin.pulse && f.enabled !== false;
    const skip = (reason, data = {}) => {
        const row = { ...base, ...data, status: 'SKIP', skip: reason };
        return { row, holders: row.aHolders };
    };
    try {
        const ph = coin.pulse ? coin.pulse.holders : -1;
        if (useFilter && ph >= 0 && ph < f.minHolders) {
            return skip(`HOLDER ${ph} < ${f.minHolders}`, { aHolders: ph });
        }

        onStep('Axiom');
        const ax = await readAxiom(page, pw, coin.ca);
        const axOk = ax.ok && ax.holders >= 0;
        const { ok: _a, holders, ...axData } = ax;
        if (holders >= 0) axData.aHolders = holders;

        if (useFilter && axOk) {
            if (ax.migVol >= 0 && ax.migVol < f.minMigVol) {
                // hanya data migrasi, holder, dan volume yang dicatat
                const keep = ['aHolders', 'createdAt', 'ageNote', 'migAt', 'migVol', 'lastVol', 'migNote'];
                return skip(`MIGVOL ${ax.migVol} < ${f.minMigVol}`, Object.fromEntries(keep.map((k) => [k, axData[k]])));
            }
            const fail = axiomRules(f, axData);
            if (fail.length) return skip(fail.join(' + '), axData);
        }

        onStep('GMGN');
        const gm = await readGmgn(page, pw, coin.ca);
        const status = !axOk ? 'AXIOM_GAGAL' : (gm.ok ? 'OK' : 'GMGN_GAGAL');
        const { ok: _g, ...gmData } = gm;
        const row = { ...base, ...axData, ...gmData, status };
        return { row, holders: row.aHolders };
    } catch (e) {
        return { row: { ...base, status: 'ERROR' }, holders: -1, error: e.message };
    }
}

module.exports = { scrapeCoin, EMPTY };
