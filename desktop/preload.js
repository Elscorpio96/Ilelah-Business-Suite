// Safe bridge between the app page and the Windows shell (only these two actions).
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ilelahDesktop", {
  print: () => ipcRenderer.invoke("ilelah:print"),
  savePdf: (name) => ipcRenderer.invoke("ilelah:pdf", String(name || "receipt")),
});
