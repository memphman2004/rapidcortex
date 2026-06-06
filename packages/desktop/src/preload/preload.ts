import { contextBridge, ipcRenderer } from "electron";

export interface MapKitTokenResponse {
  success: boolean;
  token?: string;
  error?: string;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getAppPath: () => Promise<string>;
  getMapKitToken: () => Promise<MapKitTokenResponse>;
  isMapKitAvailable: () => Promise<boolean>;
  platform: string;
  isMac: boolean;
  isWindows: boolean;
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  getMapKitToken: () => ipcRenderer.invoke("get-mapkit-token"),
  isMapKitAvailable: () => ipcRenderer.invoke("is-mapkit-available"),
  platform: process.platform,
  isMac: process.platform === "darwin",
  isWindows: process.platform === "win32",
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
