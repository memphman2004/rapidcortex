import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { getMapKitTokenServer } from "./mapkit-token-server.js";

let mainWindow: BrowserWindow | null = null;

function rendererUrl(): string {
  if (!app.isPackaged) {
    return process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
  }
  return `file://${path.join(__dirname, "../dist-renderer/index.html")}`;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void win.loadURL(rendererUrl());
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  return win;
}

function setupIpcHandlers(): void {
  ipcMain.handle("get-app-version", () => app.getVersion());
  ipcMain.handle("get-app-path", () => app.getAppPath());

  ipcMain.handle("get-mapkit-token", () => {
    try {
      const tokenServer = getMapKitTokenServer();
      const token = tokenServer.generateToken();
      return { success: true as const, token };
    } catch (error) {
      console.error("[mapkit] token generation failed:", error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  ipcMain.handle("is-mapkit-available", () => {
    try {
      getMapKitTokenServer();
      return true;
    } catch {
      return false;
    }
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
