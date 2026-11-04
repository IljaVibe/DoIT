const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("doit", {
  load: () => ipcRenderer.invoke("state:load"),
  save: (state) => ipcRenderer.invoke("state:save", state),
  attach: () => ipcRenderer.invoke("files:attach"),
  openFile: (id) => ipcRenderer.invoke("files:open", id),
  exportBackup: () => ipcRenderer.invoke("backup:export"),
  importBackup: () => ipcRenderer.invoke("backup:import"),
  searchCity: (query) => ipcRenderer.invoke("weather:search", query),
  weather: (city) => ipcRenderer.invoke("weather:get", city),
});
