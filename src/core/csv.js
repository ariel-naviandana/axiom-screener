// src/core/csv.js — urutan kolom & tulis baris CSV (format sama dengan versi UI.Vision, tanpa quoting)
const fs = require('fs');
const path = require('path');

// Nilai aman untuk CSV tanpa quoting (macro juga tidak memakai quoting)
const cell = (v) => String(v ?? '').replace(/[,\r\n"]/g, ' ').trim();

// Urutan kolom CSV (index = row['n'] di n8n)
const COLUMNS = [
    'ts',          // row['0']  waktu dicatat (WIB)
    'name',        // row['1']
    'ca',          // row['2']
    // statistik Axiom (detail)
    'aTop10',      // row['3']  Top 10 H. %
    'aDev',        // row['4']  Dev H. %
    'aSnipers',    // row['5']  Snipers H. %
    'aInsiders',   // row['6']  Insiders %
    'aBundlers',   // row['7']  Bundlers %
    'aLpBurned',   // row['8']  LP Burned %
    'aHolders',    // row['9']  holder (tab "Holders (n)", cadangan kotak statistik / baris Pulse)
    'aProTraders', // row['10'] Pro Traders
    'aDexPaid',    // row['11'] Dex Paid
    // statistik GMGN
    'gTop10',      // row['12']
    'gDev',        // row['13']
    'gHolders',    // row['14']
    'gSnipers',    // row['15']
    'gInsiders',   // row['16']
    'gPhishing',   // row['17']
    'gBundler',    // row['18']
    'gDexPaid',    // row['19']
    'gNoMint',     // row['20'] OK / BAD:...
    'gNoBlacklist',// row['21'] OK / BAD:...
    'gBurnt',      // row['22']
    'aMcap',       // row['23'] market cap Axiom (USD)
    // chart Axiom (config migCandle)
    'migAt',       // row['24'] waktu migrasi (WIB)
    'migVol',      // row['25'] volume candle migrasi (USD)
    'lastVol',     // row['26'] volume candle terbaru (USD)
    // baris Pulse (screener saja; watcher '-' / -1)
    'xHandle',     // row['27'] akun X/Twitter (@...)
    'xType',       // row['28'] kartu X: post / profile / -
    'xText',       // row['29'] isi tweet (post) atau bio akun (profile)
    'kol',         // row['30'] jumlah KOL
    'aFees',       // row['31'] Global Fees Paid (SOL), detail Axiom
    'xPostedAt',   // row['32'] waktu tweet diposting (WIB), dari id tweet; '-' kalau bukan kartu post (screener saja)
    'xUrl',        // row['33'] link tweet (https://x.com/<akun>/status/<id>); '-' kalau tidak ada
    'createdAt',   // row['34'] waktu coin dibuat (WIB, yyyy-MM-dd HH:mm:ss), dari tooltip label umur di detail Axiom; '-' kalau tidak terbaca
    'skip',        // row['35'] alasan SKIP, '-' kalau tidak di-skip
    'status',      // row['36'] OK / AXIOM_GAGAL / GMGN_GAGAL / ERROR / TIMEOUT / SKIP
];

// Tulis satu baris (append) ke file CSV
function appendRow(filePath, row) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const line = COLUMNS.map((c) => cell(row[c])).join(',') + '\n';
    fs.appendFileSync(filePath, line, 'utf8');
}

module.exports = { appendRow, COLUMNS };
