// screener.js — Script 1
// Jalankan macro axiom_screener lewat UI.Vision sesuai jadwal cron (default tiap 10 menit)
// Chrome dibuka dengan profil screener (--profile-directory). Tidak ada kill Chrome:
// macro menutup jendelanya sendiri (closeBrowser=1), profil lain tidak terganggu.
const cron = require('node-cron');
const { loadConfig } = require('./lib/config');
const { launchChrome } = require('./lib/chrome');

const cfg = loadConfig();
const S = cfg.screener;

if (!cron.validate(S.schedule)) {
    console.error(`Format cron tidak valid: "${S.schedule}"`);
    process.exit(1);
}

const nowWIB = () => new Date().toLocaleString('id-ID', { timeZone: cfg.timezone });

async function runUivision(macroName) {
    console.log(`[${nowWIB()}] >>> MENJALANKAN: ${macroName} (profil "${S.profileDirectory}") <<<`);
    const url = `${cfg.uivisionHtml}?macro=${encodeURIComponent(macroName)}&direct=1&closeRPA=1&closeBrowser=1&storage=xfile`;
    const err = await launchChrome({ url, profileDirectory: S.profileDirectory, chromePath: cfg.chromePath });
    if (err) console.error(`[${nowWIB()}] Error menjalankan ${macroName}:`, err.message);
}

cron.schedule(S.schedule, () => {
    console.log(`\n[${nowWIB()}] [JADWAL] ${S.macroName}`);
    runUivision(S.macroName);
}, { timezone: cfg.timezone });

console.log('='.repeat(50));
console.log('✅ SCREENER AKTIF');
console.log(`   Macro  : ${S.macroName}`);
console.log(`   Profil : ${S.profileDirectory}`);
console.log(`   Jadwal : ${S.schedule}`);
console.log(`   HTML   : ${cfg.uivisionHtml}`);
console.log(`   Zona   : ${cfg.timezone}`);
console.log('='.repeat(50));

if (S.runOnStart) {
    console.log(`\n[${nowWIB()}] [STARTUP] ${S.macroName}`);
    runUivision(S.macroName);
}
