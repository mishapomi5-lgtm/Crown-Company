/**
 * Preload script — runs in an isolated context before the renderer page loads.
 * contextIsolation is enabled, so this is the only place Node.js APIs are
 * available from the renderer side.
 *
 * We intentionally expose only a minimal, read-only bridge so the renderer
 * cannot reach Node.js internals directly.
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronBridge', {
  /** The OS platform — can be used for platform-specific UX tweaks. */
  platform: process.platform as string,
  /** Lets renderer code detect it is running inside Electron. */
  isElectron: true as boolean,
});
