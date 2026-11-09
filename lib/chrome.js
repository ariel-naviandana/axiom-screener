// lib/chrome.js
// Buka Chrome dengan profil tertentu (--profile-directory) di User Data default Chrome.
// Semua profil berjalan di satu proses Chrome, jadi bot TIDAK mematikan Chrome sama sekali:
// macro menutup jendelanya sendiri lewat closeBrowser=1.
const { spawn } = require('child_process');

const DEFAULT_CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// profileDirectory: nama folder profil, mis. "Profile 2" atau "Axiom Screener".
// Kalau folder belum ada, Chrome otomatis membuat profil baru dengan nama itu.
function launchChrome({ url, profileDirectory, chromePath = DEFAULT_CHROME_PATH }) {
    const args = [
        '--new-window',
        '--start-maximized',
        '--window-size=1920,1080',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-session-crashed-bubble',
        '--hide-crash-restore-bubble',
        '--no-first-run',
        '--no-default-browser-check',
    ];
    if (profileDirectory) args.unshift(`--profile-directory=${profileDirectory}`);
    args.push(url);

    return new Promise((resolve) => {
        try {
            const child = spawn(chromePath, args, { detached: true, stdio: 'ignore' });
            child.once('error', (err) => resolve(err));
            child.once('spawn', () => { child.unref(); resolve(null); });
        } catch (err) {
            resolve(err);
        }
    });
}

module.exports = { launchChrome };
