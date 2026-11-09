// screener.js — Script 1
// Jalankan macro axiom_screener lewat UI.Vision sesuai jadwal cron (default tiap 10 menit)
// Pakai profil Chrome default; Chrome milik watcher TIDAK ikut dimatikan
const cron = require('node-cron');
const { loadConfig } = require('./lib/config');
const { killChrome, launchChrome } = require('./lib/chrome');

const cfg = loadConfig();
const S = cfg.screener;

if (!cron.validate(S.schedule)) {
    console.error(`Format cron tidak valid: "${S.schedule}"`);
    process.exit(1);
}

const nowWIB = () => new Date().toLocaleString('id-ID', { timeZone: cfg.timezone });

async function runUivision(macroName) {
    // 1. Matikan Chrome lama
    //    - profileDir diisi : hanya Chrome screener (profil terpisah), Chrome lain aman
    //    - profileDir kosong: semua Chrome kecuali Chrome watcher (profil default)
    const killed = S.profileDir
        ? await killChrome({ only: S.profileDir })
        : await killChrome({ except: cfg.watcher.profileDir });
    console.log(`[${nowWIB()}] ${killed ? `${killed} Chrome lama dimatikan` : 'Tidak ada Chrome yang berjalan'}`);
    await new Promise((r) => setTimeout(r, cfg.killWaitMs));

    // 2. Buka Chrome baru dan jalankan macro
    console.log(`[${nowWIB()}] >>> MENJALANKAN: ${macroName} <<<`);
    const url = `${cfg.uivisionHtml}?macro=${macroName}&direct=1&closeRPA=1&closeBrowser=1&storage=xfile`;
    const err = await launchChrome({
        url,
        userDataDir: S.profileDir || undefined,
        profileDirectory: S.profileDirectory || undefined,
        chromePath: cfg.chromePath,
    });
    if (err) console.error(`[${nowWIB()}] Error menjalankan ${macroName}:`, err.message);
}

cron.schedule(S.schedule, () => {
    console.log(`\n[${nowWIB()}] [JADWAL] ${S.macroName}`);
    runUivision(S.macroName);
}, { timezone: cfg.timezone });

console.log('='.repeat(50));
console.log('✅ SCREENER AKTIF');
console.log(`   Macro  : ${S.macroName}`);
console.log(`   Jadwal : ${S.schedule}`);
console.log(`   HTML   : ${cfg.uivisionHtml}`);
console.log(`   Zona   : ${cfg.timezone}`);
console.log(`   Profil : ${S.profileDir || 'User Data default (Chrome watcher dikecualikan dari kill)'}${S.profileDirectory ? ` / ${S.profileDirectory}` : ''}`);
console.log('='.repeat(50));

if (S.runOnStart) {
    console.log(`\n[${nowWIB()}] [STARTUP] ${S.macroName}`);
    runUivision(S.macroName);
}
