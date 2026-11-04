const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  net,
  session,
  Tray,
  Menu,
  screen,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Store } = require("./store.cjs");
const { Accounts } = require("./accounts.cjs");
const { Desktop } = require("./desktop.cjs");
const { stateSchema, citySchema } = require("./schema.cjs");
const {
  MAX_BACKUP,
  archive,
  parseArchive,
  accountBackup,
  restoreAccount,
} = require("./backup.cjs");
let window,
  legacy,
  accounts,
  active = null,
  desktop,
  quitting = false,
  rendererReady = false,
  closePending = false,
  wantQuit = false,
  tempDir;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
function showMain() {
  desktop?.showMain();
}
app.on("second-instance", () => showMain());
function mainSender(event) {
  return (
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame
  );
}
function handle(channel, fn, protectedRoute = false) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!mainSender(event)) throw new Error("Доступ запрещён");
    if (protectedRoute && !active) throw new Error("Сначала войдите в аккаунт");
    try {
      return await fn(...args);
    } catch (e) {
      console.error(channel, e.message);
      throw new Error(
        e.name === "ZodError"
          ? "Некорректные данные. Проверьте поля или файл копии."
          : e.message,
      );
    }
  });
}
function authInfo() {
  return {
    session: active ? (active.profile ? "account" : "guest") : "locked",
    profile: active?.profile
      ? accounts.list().find((p) => p.id === active.profile.id)
      : null,
    accounts: accounts.list(),
    hasLegacy: !!(
      legacy.load().tasks.length ||
      legacy.load().notes.length ||
      legacy.load().goals.length ||
      legacy.load().attachments.length
    ),
  };
}
function clearSession() {
  clearTimeout(desktop?.backupTimer);
  if (active?.profile) {
    active.store.close();
    active.key.fill(0);
  }
  active = null;
  if (tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      console.warn(
        "An opened document is still in use; its temporary copy could not be removed.",
      );
    }
    tempDir = null;
  }
}
function activate(next) {
  clearSession();
  active = next;
  desktop?.syncWidgets();
  desktop?.broadcast();
  window.webContents.send("auth:changed", authInfo());
  return authInfo();
}
function changed(patch) {
  desktop?.broadcast();
  desktop?.scheduleBackup();
  if (patch) window.webContents.send("state:patch", patch);
}
function finishQuit() {
  quitting = true;
  desktop?.shutdown();
  clearSession();
  legacy?.close();
  app.quit();
}
async function completeClose() {
  closePending = false;
  if (!wantQuit && desktop.config.closeToTray && desktop.tray) {
    window.hide();
    return;
  }
  const prefs = desktop.preferences();
  if (active?.profile && prefs.backupFolder) {
    try {
      desktop.backupNow();
    } catch {
      const result = await dialog.showMessageBox(window, {
        type: "warning",
        buttons: ["Остаться", "Выйти"],
        defaultId: 0,
        cancelId: 0,
        message:
          "Данные сохранены на этом компьютере, но резервная копия не обновлена. Проверьте папку копий в настройках.",
      });
      if (result.response !== 1) {
        wantQuit = false;
        showMain();
        return;
      }
    }
  }
  finishQuit();
}
function requestQuit() {
  wantQuit = true;
  if (window && !window.isDestroyed()) window.close();
  else finishQuit();
}
async function json(url) {
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await net.fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error("Сервис погоды временно недоступен");
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}
async function main() {
  if (process.platform === "win32") app.setAppUserModelId("app.doit.desktop");
  const root = process.env.DOIT_DATA_DIR || app.getPath("userData");
  legacy = await new Store().init(root);
  accounts = new Accounts(root);
  if (process.env.HTTPS_PROXY)
    await session.defaultSession.setProxy({
      proxyRules: process.env.HTTPS_PROXY,
    });
  handle("auth:info", () => authInfo());
  handle("auth:create", async (name, password, migrate) => {
    if (active?.profile)
      throw new Error("Сначала выйдите из текущего аккаунта");
    return activate(
      await accounts.create(name, password, migrate === true ? legacy : null),
    );
  });
  handle("auth:login", async (id, password) => {
    if (active) throw new Error("Аккаунт уже открыт");
    return activate(await accounts.login(id, password));
  });
  handle("auth:guest", () => {
    if (active?.profile) throw new Error("Сначала выйдите из аккаунта");
    return activate({ store: legacy, profile: null, key: null });
  });
  handle("auth:logout", () => {
    if (active?.profile && desktop.preferences().backupFolder) {
      try {
        desktop.backupNow();
      } catch (e) {
        console.warn("Backup before locking:", e.message);
      }
    }
    clearSession();
    desktop.syncWidgets();
    desktop.broadcast();
    const info = authInfo();
    window.webContents.send("auth:changed", info);
    showMain();
    return info;
  });
  handle("auth:restore", async (password) => {
    if (active)
      throw new Error(
        "Для восстановления сначала заблокируйте текущий аккаунт",
      );
    accounts.validatePassword(password);
    const choice = await dialog.showOpenDialog(window, {
      title: "Выберите зашифрованную копию аккаунта",
      filters: [{ name: "Аккаунт DoIT", extensions: ["doit"] }],
      properties: ["openFile"],
    });
    if (choice.canceled) return null;
    const file = choice.filePaths[0];
    if (fs.statSync(file).size > MAX_BACKUP + 1024 * 1024)
      throw new Error("Копия превышает 250 МБ");
    return activate(
      await restoreAccount(fs.readFileSync(file), password, accounts),
    );
  });
  handle("state:load", () => active.store.load(), true);
  handle(
    "state:save",
    (input) => {
      const state = stateSchema.parse(input),
        store = active.store,
        known = new Map(store.load().attachments.map((a) => [a.id, a]));
      for (const a of state.attachments) {
        const old = known.get(a.id);
        if (
          !old ||
          old.storageKey !== a.storageKey ||
          old.size !== a.size ||
          old.name !== a.name
        )
          throw new Error("Добавляйте файлы через выбор документов");
      }
      const saved = store.save(state);
      changed();
      return saved;
    },
    true,
  );
  handle(
    "files:attach",
    async () => {
      const current = active,
        store = current.store;
      const choice = await dialog.showOpenDialog(window, {
        title: "Прикрепить документы",
        properties: ["openFile", "multiSelections"],
      });
      if (choice.canceled) return [];
      if (active !== current) throw new Error("Аккаунт изменился");
      const picked = choice.filePaths.map((file) => {
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > 100 * 1024 * 1024)
          throw new Error("Можно прикрепить файл размером до 100 МБ");
        return { file, size: stat.size };
      });
      const added = [];
      try {
        for (const { file, size } of picked) {
          const id = randomUUID(),
            ext = path.extname(file).slice(1).toLowerCase(),
            storageKey = id + (/^[a-z0-9]{1,12}$/.test(ext) ? "." + ext : "");
          store.writeAttachment(storageKey, fs.readFileSync(file));
          added.push({
            id,
            name: path.basename(file),
            size,
            storageKey,
            taskId: "",
            addedAt: new Date().toISOString(),
          });
        }
        const state = store.load();
        state.attachments.push(...added);
        store.save(state);
        changed();
        return added;
      } catch (e) {
        for (const a of added)
          fs.rmSync(store.attachmentPath(a.storageKey), { force: true });
        throw e;
      }
    },
    true,
  );
  handle(
    "files:open",
    async (id) => {
      const item = active.store.load().attachments.find((a) => a.id === id);
      if (!item) throw new Error("Файл не найден");
      if (
        [item.name, item.storageKey].some((name) =>
          /\.(exe|com|bat|cmd|ps1|vbs|js|jse|msi|scr|lnk|url|hta|reg)$/i.test(
            name,
          ),
        )
      )
        throw new Error("Запуск исполняемых файлов из DoIT отключён");
      let file = active.store.attachmentPath(item.storageKey);
      if (active.profile) {
        tempDir ||= fs.mkdtempSync(
          path.join(app.getPath("temp"), "DoIT-open-"),
        );
        file = path.join(tempDir, item.storageKey);
        fs.writeFileSync(file, active.store.readAttachment(item.storageKey), {
          mode: 0o600,
        });
      }
      const error = await shell.openPath(file);
      if (error) throw new Error("Не удалось открыть файл: " + error);
    },
    true,
  );
  handle(
    "backup:export",
    async () => {
      const current = active,
        isAccount = !!current.profile;
      const choice = await dialog.showSaveDialog(window, {
        title: "Сохранить копию с документами",
        defaultPath: `DoIT-${new Date().toISOString().slice(0, 10)}.${isAccount ? "doit" : "zip"}`,
        filters: [
          {
            name: isAccount ? "Зашифрованный аккаунт DoIT" : "Копия DoIT",
            extensions: [isAccount ? "doit" : "zip"],
          },
        ],
      });
      if (choice.canceled) return false;
      if (active !== current) throw new Error("Аккаунт изменился");
      fs.writeFileSync(
        choice.filePath,
        isAccount ? accountBackup(current) : archive(current.store),
        { mode: 0o600, flush: true },
      );
      return true;
    },
    true,
  );
  handle(
    "backup:import",
    async () => {
      const current = active,
        store = current.store;
      const choice = await dialog.showOpenDialog(window, {
        title: "Импортировать ZIP-копию версии 0.1",
        filters: [{ name: "Копия DoIT", extensions: ["zip"] }],
        properties: ["openFile"],
      });
      if (choice.canceled) return null;
      if (active !== current) throw new Error("Аккаунт изменился");
      const file = choice.filePaths[0];
      if (fs.statSync(file).size > MAX_BACKUP + 1024 * 1024)
        throw new Error("Копия превышает 250 МБ");
      const content = parseArchive(fs.readFileSync(file));
      const answer = await dialog.showMessageBox(window, {
        type: "question",
        buttons: ["Отмена", "Восстановить"],
        defaultId: 0,
        cancelId: 0,
        title: "Восстановление копии",
        message:
          "Текущие записи будут заменены. Сначала сохраните копию, если данные нужны.",
      });
      if (answer.response !== 1) return null;
      const staged = [];
      try {
        for (const a of content.state.attachments) {
          const bytes = content.attachments.get(a.storageKey);
          a.storageKey = randomUUID() + path.extname(a.storageKey);
          store.writeAttachment(a.storageKey, bytes);
          staged.push(a.storageKey);
        }
        const saved = store.save(content.state);
        changed();
        return saved;
      } catch (e) {
        for (const key of staged)
          fs.rmSync(store.attachmentPath(key), { force: true });
        throw e;
      }
    },
    true,
  );
  handle("desktop:get", () => desktop.preferences());
  handle("desktop:set", (patch) => desktop.apply(patch));
  handle(
    "desktop:backup-folder",
    async () => {
      if (!active?.profile) throw new Error("Сначала войдите в аккаунт");
      const current = active;
      const choice = await dialog.showOpenDialog(window, {
        title: "Выберите папку копий — например, в OneDrive",
        properties: ["openDirectory", "createDirectory"],
        defaultPath: process.env.OneDrive || app.getPath("documents"),
      });
      if (!choice.canceled) {
        if (active !== current) throw new Error("Аккаунт изменился");
        return desktop.setBackupFolder(choice.filePaths[0]);
      }
      return desktop.preferences();
    },
    true,
  );
  handle("desktop:backup-now", () => desktop.backupNow(), true);
  handle(
    "weather:search",
    async (query) => {
      if (
        typeof query !== "string" ||
        query.trim().length < 2 ||
        query.length > 200
      )
        return [];
      const data = await json(
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
          encodeURIComponent(query.trim()) +
          "&count=6&language=ru&format=json",
      );
      return (data.results || []).map((c) => ({
        name: [c.name, c.admin1, c.country].filter(Boolean).join(", "),
        latitude: c.latitude,
        longitude: c.longitude,
      }));
    },
    true,
  );
  handle(
    "weather:get",
    async (city) => {
      const valid = citySchema.parse(city);
      if (!valid) return null;
      const data = await json(
        `https://api.open-meteo.com/v1/forecast?latitude=${valid.latitude}&longitude=${valid.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
      );
      return {
        temperature: data.current.temperature_2m,
        code: data.current.weather_code,
        high: data.daily.temperature_2m_max[0],
        low: data.daily.temperature_2m_min[0],
        updatedAt: new Date().toISOString(),
      };
    },
    true,
  );
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#f8f9f6",
    title: "DoIT",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    show: !process.argv.includes("--background"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  desktop = new Desktop(
    { app, BrowserWindow, Tray, Menu, screen },
    root,
    window,
    () => active,
    changed,
    () => {
      showMain();
      window.webContents.send("auth:lock-request");
    },
    requestQuit,
  );
  if (process.argv.includes("--background") && !desktop.tray) window.show();
  ipcMain.on("app:renderer-ready", (event) => {
    if (mainSender(event)) rendererReady = true;
  });
  ipcMain.on("app:close-ready", (event, success) => {
    if (mainSender(event) && closePending) {
      if (success === true) completeClose();
      else {
        closePending = false;
        wantQuit = false;
        showMain();
      }
    }
  });
  window.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    if (rendererReady) window.webContents.send("app:before-close");
    else completeClose();
  });
  window.webContents.on("render-process-gone", () => {
    rendererReady = false;
    closePending = false;
  });
  for (const channel of ["load", "toggle", "add", "open", "hide", "progress"])
    ipcMain.handle("widget:" + channel, async (event, value) => {
      const kind = desktop.kindFor(event);
      if (!active) throw new Error("Аккаунт заблокирован");
      if (channel === "load") return desktop.snapshot(kind);
      if (channel === "open") {
        showMain();
        return;
      }
      if (channel === "hide") {
        desktop.apply({
          widgets: { ...desktop.config.widgets, [kind]: false },
        });
        return;
      }
      const state = active.store.load();
      let patch;
      if (channel === "toggle") {
        if (kind !== "tasks") throw new Error("Доступ запрещён");
        const task = state.tasks.find((t) => t.id === value);
        if (!task) throw new Error("Задача не найдена");
        task.completed = !task.completed;
        patch = { collection: "tasks", record: task };
      }
      if (channel === "progress") {
        if (kind !== "goals") throw new Error("Доступ запрещён");
        const goal = state.goals.find((g) => g.id === value);
        if (!goal) throw new Error("Цель не найдена");
        goal.progress = Math.min(goal.target, goal.progress + 1);
        patch = { collection: "goals", record: goal };
      }
      if (channel === "add") {
        if (typeof value !== "string" || !value.trim() || value.length > 500)
          throw new Error("Введите от 1 до 500 символов");
        const now = new Date(),
          date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        if (kind === "tasks") {
          const task = {
            id: randomUUID(),
            title: value.trim(),
            description: "",
            date,
            priority: "normal",
            projectId: "",
            completed: false,
            subtasks: [],
            createdAt: now.toISOString(),
          };
          state.tasks.unshift(task);
          patch = { collection: "tasks", record: task };
        } else if (kind === "note") {
          const note = {
            id: randomUUID(),
            title: value.trim(),
            body: "",
            kind: "note",
            pinned: false,
            updatedAt: now.toISOString(),
          };
          state.notes.unshift(note);
          patch = { collection: "notes", record: note };
        } else throw new Error("Доступ запрещён");
      }
      active.store.save(state);
      changed(patch);
      return desktop.snapshot(kind);
    });
  await window.loadFile(path.join(__dirname, "../dist/index.html"));
}
if (lock)
  app
    .whenReady()
    .then(main)
    .catch((error) => {
      console.error(error);
      dialog.showErrorBox(
        "Не удалось запустить DoIT",
        "Ваши данные сохранены.\n" + error.message,
      );
      app.exit(1);
    });
app.on("before-quit", (event) => {
  if (!quitting && window && !window.isDestroyed()) {
    event.preventDefault();
    requestQuit();
  }
});
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});
