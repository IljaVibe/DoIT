const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("doit", {
  authInfo: () => ipcRenderer.invoke("auth:info"),
  createAccount: (name, password, migrate) =>
    ipcRenderer.invoke("auth:create", name, password, migrate),
  login: (id, password) => ipcRenderer.invoke("auth:login", id, password),
  logout: () => ipcRenderer.invoke("auth:logout"),
  guest: () => ipcRenderer.invoke("auth:guest"),
  restoreAccount: (password) => ipcRenderer.invoke("auth:restore", password),
  onAuthChanged: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on("auth:changed", listener);
    return () => ipcRenderer.removeListener("auth:changed", listener);
  },
  onLockRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("auth:lock-request", listener);
    return () => ipcRenderer.removeListener("auth:lock-request", listener);
  },
  onPatch: (callback) => {
    const listener = (_event, patch) => callback(patch);
    ipcRenderer.on("state:patch", listener);
    return () => ipcRenderer.removeListener("state:patch", listener);
  },
  desktopPreferences: () => ipcRenderer.invoke("desktop:get"),
  setDesktopPreferences: (patch) => ipcRenderer.invoke("desktop:set", patch),
  chooseBackupFolder: () => ipcRenderer.invoke("desktop:backup-folder"),
  backupNow: () => ipcRenderer.invoke("desktop:backup-now"),
  onBeforeClose: (callback) => {
    const listener = async () => {
      try {
        ipcRenderer.send("app:close-ready", await callback());
      } catch {
        ipcRenderer.send("app:close-ready", false);
      }
    };
    ipcRenderer.on("app:before-close", listener);
    ipcRenderer.send("app:renderer-ready");
    return () => ipcRenderer.removeListener("app:before-close", listener);
  },
  load: () => ipcRenderer.invoke("state:load"),
  save: (state) => ipcRenderer.invoke("state:save", state),
  attach: () => ipcRenderer.invoke("files:attach"),
  openFile: (id) => ipcRenderer.invoke("files:open", id),
  exportBackup: () => ipcRenderer.invoke("backup:export"),
  importBackup: () => ipcRenderer.invoke("backup:import"),
  searchCity: (query) => ipcRenderer.invoke("weather:search", query),
  weather: (city) => ipcRenderer.invoke("weather:get", city),
});
