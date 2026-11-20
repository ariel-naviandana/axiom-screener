// src/index.js — titik masuk Axiom Screener + Watcher (Playwright)
//   node src/index.js            screener + watcher   (npm start)
//   node src/index.js screener   screener saja        (npm run screener)
//   node src/index.js watcher    watcher saja         (npm run watcher)
//   node src/index.js login      login Axiom & GMGN   (npm run login)
// Output CSV sama dengan versi UI.Vision lama, jadi workflow n8n tidak berubah.
const mode = process.argv[2];
// log terminal bot ikut disimpan ke CSV harian (axiom_log_YYYY-MM-DD.csv di folder output)
if (mode !== 'login') require('./core/file-log').installFileLog('axiom_log');
if (mode === 'login') {
    require('./login');
} else if (!mode || mode === 'screener' || mode === 'watcher') {
    require('./runner').start(mode);
} else {
    console.log(`Mode tidak dikenal: ${mode}. Pakai: screener | watcher | login (kosong = dua-duanya)`);
    process.exit(1);
}
