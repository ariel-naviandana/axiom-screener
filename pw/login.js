// pw/login.js — buka Chrome profil bot untuk login manual ke Axiom & GMGN (sekali saja)
// Login di jendela yang terbuka, lalu tutup jendelanya. Sesi tersimpan di userDataDir.
const { loadPwConfig } = require('./config');
const { openBrowser } = require('./browser');

(async () => {
    const pw = { ...loadPwConfig(), headless: false, blockResources: false };
    console.log(`Profil: ${pw.userDataDir}`);
    console.log('Login ke Axiom dan GMGN di jendela yang terbuka, lalu TUTUP jendelanya untuk selesai.');
    const context = await openBrowser(pw);
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://axiom.trade/');
    const p2 = await context.newPage();
    await p2.goto('https://gmgn.ai/?chain=sol');
    await new Promise((r) => context.on('close', r));
    console.log('Selesai. Sesi login tersimpan.');
    process.exit(0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
