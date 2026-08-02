import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isDev = !app.isPackaged;
const API_PORT = 8080;
const VITE_PORT = 5173;

let mainWindow: BrowserWindow | null = null;
let apiServerProcess: ChildProcess | null = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Returns the path to the bundled api-server entry script.
 * In dev: points to the workspace build output.
 * In production: points to the file extracted into app's resources directory.
 */
function getApiServerScript(): string {
  if (isDev) {
    // __dirname is artifacts/electron/dist — go up to artifacts/
    return path.join(__dirname, '..', '..', 'api-server', 'dist', 'index.mjs');
  }
  return path.join(process.resourcesPath, 'api-server', 'dist', 'index.mjs');
}

/**
 * Returns the data directory for SQLite + backup files.
 * In dev: uses the workspace data directory so existing data is preserved.
 * In production: uses the OS user data directory so data persists across app updates.
 */
function getDataDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'api-server', 'data');
  }
  const dataDir = path.join(app.getPath('userData'), 'ledger-data');
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

/**
 * Returns the directory containing the built frontend static files,
 * or undefined when in dev (Vite dev server handles it).
 */
function getStaticDir(): string | undefined {
  if (isDev) return undefined;
  return path.join(process.resourcesPath, 'ledger', 'dist', 'public');
}

// ---------------------------------------------------------------------------
// API server child process
// ---------------------------------------------------------------------------

function startApiServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    const serverScript = getApiServerScript();
    const dataDir = getDataDir();
    const staticDir = getStaticDir();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(API_PORT),
      NODE_ENV: isDev ? 'development' : 'production',
      SQLITE_DATA_DIR: dataDir,
      // Make Electron binary behave as plain Node.js for the child process
      ELECTRON_RUN_AS_NODE: '1',
    };
    if (staticDir) {
      env.ELECTRON_STATIC_DIR = staticDir;
    }

    console.log('[electron] Starting API server:', serverScript);
    console.log('[electron] Data directory:', dataDir);

    apiServerProcess = spawn(
      process.execPath,           // Electron binary (acts as Node.js via ELECTRON_RUN_AS_NODE)
      ['--enable-source-maps', serverScript],
      { env, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let resolved = false;
    const tryResolve = (): void => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    apiServerProcess.stdout?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString();
      process.stdout.write(`[api] ${msg}`);
      if (msg.includes('Server listening')) tryResolve();
    });

    apiServerProcess.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(`[api:err] ${chunk.toString()}`);
    });

    apiServerProcess.on('exit', (code, signal) => {
      if (!isQuitting) {
        // The server calls process.exit(0) after a backup restore — restart it.
        console.log(`[electron] API server exited (code=${code}, signal=${signal}). Restarting in 1.5 s…`);
        setTimeout(() => {
          startApiServer()
            .then(() => {
              // Give the server a moment to initialize, then reload the window.
              if (mainWindow && !mainWindow.isDestroyed()) {
                setTimeout(() => {
                  mainWindow?.webContents.reload();
                }, 1500);
              }
            })
            .catch(console.error);
        }, 1500);
      }
    });

    // Fallback: resolve after 12 seconds even if we never saw the ready message.
    setTimeout(tryResolve, 12_000);
  });
}

// ---------------------------------------------------------------------------
// Browser window
// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Crown King Ledger',
    // Show only once the page has rendered to avoid the white-flash.
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const url = isDev
    ? `http://localhost:${VITE_PORT}`
    : `http://localhost:${API_PORT}`;

  mainWindow.loadURL(url).catch((err: Error) => {
    console.error('[electron] Failed to load URL:', err.message);
  });

  // Open external links (if any) in the OS browser, not inside Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url: href }) => {
    shell.openExternal(href);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  if (!isDev) {
    // Production: start the bundled API server before showing the window.
    await startApiServer();
  }
  // Dev: API server + Vite are started externally by the dev script (concurrently).
  createWindow();
});

app.on('window-all-closed', () => {
  isQuitting = true;
  apiServerProcess?.kill('SIGTERM');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  apiServerProcess?.kill('SIGTERM');
});

app.on('activate', () => {
  // Re-create window on macOS when dock icon is clicked and no windows are open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
