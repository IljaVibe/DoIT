const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("doitWidget", {
  load: () => ipcRenderer.invoke("widget:load"),
  toggle: (id) => ipcRenderer.invoke("widget:toggle", id),
  progress: (id) => ipcRenderer.invoke("widget:progress", id),
  add: (text) => ipcRenderer.invoke("widget:add", text),
  open: () => ipcRenderer.invoke("widget:open"),
  hide: () => ipcRenderer.invoke("widget:hide"),
  onChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("widget:changed", listener);
    return () => ipcRenderer.removeListener("widget:changed", listener);
  },
});
