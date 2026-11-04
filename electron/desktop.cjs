const fs = require("node:fs");
const path = require("node:path");
const { z } = require("zod");
const { atomicJSON } = require("./accounts.cjs");
const { writeAutomaticBackup } = require("./backup.cjs");
const kinds = ["tasks", "goals", "note"];
const patchSchema = z
  .object({
    autoStart: z.boolean().optional(),
    closeToTray: z.boolean().optional(),
    alwaysOnTop: z.boolean().optional(),
    widgets: z
      .object({ tasks: z.boolean(), goals: z.boolean(), note: z.boolean() })
      .optional(),
  })
  .strict();
const configSchema = z.object({
  autoStart: z.boolean().default(false),
  closeToTray: z.boolean().default(false),
  alwaysOnTop: z.boolean().default(false),
  widgets: z
    .object({ tasks: z.boolean(), goals: z.boolean(), note: z.boolean() })
    .default({ tasks: false, goals: false, note: false }),
  backupFolders: z.record(z.string(), z.string()).default({}),
  backupLast: z.record(z.string(), z.string()).default({}),
  bounds: z
    .record(
      z.string(),
      z.object({
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int().min(260).max(32000),
        height: z.number().int().min(220).max(32000),
      }),
    )
    .default({}),
});
class Desktop {
  constructor(electron, root, mainWindow, getActive, onChange, onLock, onQuit) {
    this.electron = electron;
    this.file = path.join(root, "desktop.json");
    this.mainWindow = mainWindow;
    this.getActive = getActive;
    this.onChange = onChange;
    this.onLock = onLock;
    this.onQuit = onQuit;
    this.windows = new Map();
    this.errors = {};
    this.config = configSchema.parse(
      fs.existsSync(this.file)
        ? JSON.parse(fs.readFileSync(this.file, "utf8"))
        : {},
    );
    this.createTray();
    this.syncWidgets();
    this.refreshTimer = setInterval(() => this.broadcast(), 60000);
  }
  persist() {
    atomicJSON(this.file, this.config);
  }
  preferences() {
    const active = this.getActive(),
      id = active?.profile?.id;
    let autoStart = this.config.autoStart;
    if (process.platform === "win32" && this.electron.app.isPackaged) {
      autoStart = this.electron.app.getLoginItemSettings({
        path: this.electron.app.getPath("exe"),
        args: ["--background"],
      }).openAtLogin;
    }
    return {
      ...this.config,
      autoStart,
      backupFolders: undefined,
      backupLast: undefined,
      bounds: undefined,
      autoStartSupported:
        process.platform === "win32" && this.electron.app.isPackaged,
      backupFolder: id ? this.config.backupFolders[id] || "" : "",
      backupLastAt: id ? this.config.backupLast[id] || "" : "",
      backupError: id ? this.errors[id] || "" : "",
    };
  }
  apply(input) {
    const patch = patchSchema.parse(input);
    if (patch.autoStart !== undefined) {
      if (!this.preferences().autoStartSupported)
        throw new Error(
          "Автозапуск доступен после установки приложения в Windows",
        );
      this.electron.app.setLoginItemSettings({
        openAtLogin: patch.autoStart,
        path: this.electron.app.getPath("exe"),
        args: ["--background"],
        name: "DoIT",
      });
    }
    this.config = { ...this.config, ...patch };
    this.persist();
    this.syncWidgets();
    this.updateTray();
    return this.preferences();
  }
  showMain() {
    if (this.mainWindow.isDestroyed()) return;
    this.mainWindow.show();
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.focus();
  }
  createTray() {
    if (process.platform === "linux" && !process.env.DISPLAY) return;
    try {
      const { Tray } = this.electron;
      this.tray = new Tray(path.join(__dirname, "icon.png"));
      this.tray.setToolTip("DoIT — ваше пространство");
      this.tray.on("double-click", () => this.showMain());
      this.tray.on("click", () => this.showMain());
      this.updateTray();
    } catch (e) {
      console.warn("Tray unavailable:", e.message);
    }
  }
  updateTray() {
    if (!this.tray) return;
    const { Menu } = this.electron;
    const active = this.getActive();
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Открыть DoIT", click: () => this.showMain() },
        { type: "separator" },
        ...kinds.map((kind) => ({
          label: {
            tasks: "Виджет задач",
            goals: "Виджет целей",
            note: "Виджет заметки",
          }[kind],
          type: "checkbox",
          checked: this.config.widgets[kind],
          enabled: !!active,
          click: () =>
            this.apply({
              widgets: {
                ...this.config.widgets,
                [kind]: !this.config.widgets[kind],
              },
            }),
        })),
        { type: "separator" },
        {
          label: "Заблокировать аккаунт",
          enabled: !!active?.profile,
          click: () => this.onLock(),
        },
        { label: "Выйти из DoIT", click: () => this.onQuit() },
      ]),
    );
  }
  snapshot(kind) {
    const active = this.getActive();
    if (!active) return null;
    const state = active.store.load(),
      d = new Date(),
      today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      kind,
      theme: state.settings.theme || "sage",
      name: state.settings.name,
      tasks: state.tasks
        .filter((t) => t.date === today && !t.completed)
        .slice(0, 30),
      goals: state.goals.filter((g) => g.progress < g.target).slice(0, 3),
      note:
        [...state.notes].sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.updatedAt.localeCompare(a.updatedAt),
        )[0] || null,
    };
  }
  syncWidgets() {
    for (const kind of kinds) {
      if (!this.getActive() || !this.config.widgets[kind]) {
        this.windows.get(kind)?.destroy();
        this.windows.delete(kind);
        continue;
      }
      let win = this.windows.get(kind);
      if (!win || win.isDestroyed()) {
        const { BrowserWindow, screen } = this.electron;
        const area = screen.getPrimaryDisplay().workArea;
        const previous = this.config.bounds[kind] || {
          x: area.x + area.width - 355,
          y: area.y + 40 + kinds.indexOf(kind) * 65,
          width: 325,
          height: kind === "tasks" ? 380 : 310,
        };
        const bounds = {
          ...previous,
          width: Math.min(previous.width, area.width),
          height: Math.min(previous.height, area.height),
          x: Math.max(
            area.x,
            Math.min(previous.x, area.x + area.width - previous.width),
          ),
          y: Math.max(
            area.y,
            Math.min(previous.y, area.y + area.height - previous.height),
          ),
        };
        win = new BrowserWindow({
          ...bounds,
          minWidth: 260,
          minHeight: 220,
          frame: false,
          resizable: true,
          skipTaskbar: true,
          alwaysOnTop: this.config.alwaysOnTop,
          backgroundColor: "#f8f9f6",
          webPreferences: {
            preload: path.join(__dirname, "widget-preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        this.windows.set(kind, win);
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        win.webContents.on("will-navigate", (e) => e.preventDefault());
        win.loadFile(path.join(__dirname, "../dist/index.html"), {
          query: { widget: kind },
        });
        const saveBounds = () => {
          clearTimeout(win.boundsTimer);
          win.boundsTimer = setTimeout(() => {
            if (!win.isDestroyed()) {
              this.config.bounds[kind] = win.getBounds();
              this.persist();
            }
          }, 700);
        };
        win.on("move", saveBounds);
        win.on("resize", saveBounds);
        win.on("closed", () => {
          clearTimeout(win.boundsTimer);
          this.windows.delete(kind);
        });
      } else win.setAlwaysOnTop(this.config.alwaysOnTop);
    }
  }
  kindFor(event) {
    for (const [kind, win] of this.windows)
      if (
        !win.isDestroyed() &&
        event.sender === win.webContents &&
        event.senderFrame === win.webContents.mainFrame
      )
        return kind;
    throw new Error("Доступ запрещён");
  }
  broadcast() {
    for (const [kind, win] of this.windows)
      if (!win.isDestroyed())
        win.webContents.send("widget:changed", this.snapshot(kind));
    this.updateTray();
  }
  scheduleBackup() {
    clearTimeout(this.backupTimer);
    const active = this.getActive();
    if (!active?.profile || !this.config.backupFolders[active.profile.id])
      return;
    this.backupTimer = setTimeout(() => {
      try {
        this.backupNow();
      } catch (e) {
        console.warn("Automatic backup:", e.message);
      }
    }, 10000);
  }
  backupNow() {
    clearTimeout(this.backupTimer);
    const active = this.getActive();
    if (!active?.profile)
      throw new Error("Автоматические копии доступны после входа в аккаунт");
    const id = active.profile.id,
      folder = this.config.backupFolders[id];
    if (!folder) throw new Error("Сначала выберите папку резервных копий");
    try {
      writeAutomaticBackup(active, folder);
      this.config.backupLast[id] = new Date().toISOString();
      this.errors[id] = "";
      this.persist();
    } catch (e) {
      this.errors[id] = "Не удалось обновить копию: " + e.message;
      throw e;
    }
    return this.preferences();
  }
  setBackupFolder(folder) {
    const active = this.getActive();
    if (!active?.profile) throw new Error("Сначала войдите в аккаунт");
    this.config.backupFolders[active.profile.id] = folder;
    this.persist();
    return this.backupNow();
  }
  shutdown() {
    clearInterval(this.refreshTimer);
    clearTimeout(this.backupTimer);
    for (const win of this.windows.values()) win.destroy();
    this.windows.clear();
    this.tray?.destroy();
  }
}
module.exports = { Desktop, configSchema };
