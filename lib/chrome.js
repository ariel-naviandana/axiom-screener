// chrome.js
// Helper bersama untuk scheduler UI.Vision: launch & kill Chrome per --user-data-dir
// Dipakai oleh scheduler screener (lama) dan scheduler watcher (baru)
const { execFile, spawn } = require('child_process');

// Ambil hanya proses Chrome UTAMA (tanpa --type=...), child process ikut mati lewat taskkill /T
const PS_LIST_MAIN = [
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" |",
    "Where-Object { $_.CommandLine -and $_.CommandLine -notlike '*--type=*' } |",
    "ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"
].join(' ');

const norm = (s) => String(s).toLowerCase().replace(/\//g, '\\');

function listMainChrome() {
    return new Promise((resolve) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', PS_LIST_MAIN],
            { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
            (err, stdout) => {
                if (err) return resolve([]);
                const list = String(stdout || '')
                    .split(/\r?\n/)
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .map((l) => {
                        const tab = l.indexOf('\t');
                        return { pid: l.slice(0, tab), cmd: norm(l.slice(tab + 1)) };
                    })
                    .filter((p) => /^\d+$/.test(p.pid));
                resolve(list);
            }
        );
    });
}

// only   : hanya Chrome yang command line-nya mengandung folder ini
// except : semua Chrome KECUALI yang mengandung folder ini
async function findMainChrome({ only, except } = {}) {
    const list = await listMainChrome();
    return list.filter((p) => {
        if (only && !p.cmd.includes(norm(only))) return false;
        if (except && p.cmd.includes(norm(except))) return false;
        return true;
    });
}

function taskkillTree(pid) {
    return new Promise((resolve) => {
        execFile('taskkill', ['/PID', pid, '/T', '/F'], { windowsHide: true }, () => resolve());
    });
}

// Return: jumlah instance Chrome yang dimatikan
async function killChrome(opts = {}) {
    const targets = await findMainChrome(opts);
    for (const p of targets) await taskkillTree(p.pid);
    return targets.length;
}

async function isChromeRunning(userDataDir) {
    return (await findMainChrome({ only: userDataDir })).length > 0;
}

const DEFAULT_CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Buka Chrome langsung lewat spawn (tanpa cmd "start"), detached supaya tidak menahan Node
// userDataDir      : folder data Chrome terpisah (--user-data-dir) -> bisa di-kill/dideteksi per bot
// profileDirectory : profil di dalam user-data-dir (--profile-directory), mis. "Profile 2"
function launchChrome({ url, userDataDir, profileDirectory, chromePath = DEFAULT_CHROME_PATH }) {
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
    if (userDataDir) args.unshift(`--user-data-dir=${userDataDir}`);
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

module.exports = { killChrome, isChromeRunning, launchChrome, findMainChrome };
