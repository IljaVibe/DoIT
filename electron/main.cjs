const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  net,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { zipSync, unzipSync, strToU8, strFromU8 } = require("fflate");
const { Store } = require("./store.cjs");
const { stateSchema, citySchema } = require("./schema.cjs");
let store, window;
const MAX_BACKUP = 250 * 1024 * 1024;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
app.on("second-instance", () => {
  if (window) {
    window.restore();
    window.focus();
  }
});
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("Доступ запрещён");
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
async function json(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await net.fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error("Сервис погоды временно недоступен");
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}
async function main() {
  const dataDir = process.env.DOIT_DATA_DIR || app.getPath("userData");
  store = await new Store().init(dataDir);
  if (process.env.HTTPS_PROXY)
    await session.defaultSession.setProxy({
      proxyRules: process.env.HTTPS_PROXY,
    });
  handle("state:load", () => store.load());
  handle("state:save", (input) => {
    const state = stateSchema.parse(input);
    const known = new Map(store.load().attachments.map((a) => [a.id, a]));
    for (const a of state.attachments) {
      const existing = known.get(a.id);
      if (
        !existing ||
        existing.storageKey !== a.storageKey ||
        existing.size !== a.size ||
        existing.name !== a.name
      )
        throw new Error("Добавляйте файлы через выбор документов");
    }
    return store.save(state);
  });
  handle("files:attach", async () => {
    const choice = await dialog.showOpenDialog(window, {
      title: "Прикрепить документы",
      properties: ["openFile", "multiSelections"],
    });
    if (choice.canceled) return [];
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
          extension = path.extname(file).slice(1).toLowerCase();
        const storageKey =
          id + (/^[a-z0-9]{1,12}$/.test(extension) ? "." + extension : "");
        fs.copyFileSync(
          file,
          store.attachmentPath(storageKey),
          fs.constants.COPYFILE_EXCL,
        );
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
      return added;
    } catch (e) {
      for (const a of added)
        fs.rmSync(store.attachmentPath(a.storageKey), { force: true });
      throw e;
    }
  });
  handle("files:open", async (id) => {
    const item = store.load().attachments.find((a) => a.id === id);
    if (!item) throw new Error("Файл не найден");
    if (
      [item.name, item.storageKey].some((name) =>
        /\.(exe|com|bat|cmd|ps1|vbs|js|jse|msi|scr|lnk|url|hta|reg)$/i.test(
          name,
        ),
      )
    )
      throw new Error("Запуск исполняемых файлов из DoIT отключён");
    const error = await shell.openPath(store.attachmentPath(item.storageKey));
    if (error) throw new Error("Не удалось открыть файл: " + error);
  });
  handle("backup:export", async () => {
    const choice = await dialog.showSaveDialog(window, {
      title: "Сохранить копию вместе с документами",
      defaultPath: `DoIT-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: "Копия DoIT", extensions: ["zip"] }],
    });
    if (choice.canceled) return false;
    const state = store.load();
    const files = { "data.json": strToU8(JSON.stringify(state)) };
    let total = files["data.json"].length;
    for (const a of state.attachments) {
      const bytes = fs.readFileSync(store.attachmentPath(a.storageKey));
      total += bytes.length;
      if (total > MAX_BACKUP) throw new Error("Копия превышает 250 МБ");
      files["attachments/" + a.storageKey] = bytes;
    }
    fs.writeFileSync(choice.filePath, zipSync(files));
    return true;
  });
  handle("backup:import", async () => {
    const choice = await dialog.showOpenDialog(window, {
      title: "Восстановить копию DoIT",
      filters: [{ name: "Копия DoIT", extensions: ["zip"] }],
      properties: ["openFile"],
    });
    if (choice.canceled) return null;
    const archive = choice.filePaths[0];
    if (fs.statSync(archive).size > MAX_BACKUP)
      throw new Error("Архив превышает 250 МБ");
    let expanded = 0;
    const files = unzipSync(fs.readFileSync(archive), {
      filter: (entry) => {
        expanded += entry.originalSize;
        if (expanded > MAX_BACKUP)
          throw new Error("Распакованная копия превышает 250 МБ");
        return true;
      },
    });
    if (!files["data.json"]) throw new Error("В архиве нет данных DoIT");
    const state = stateSchema.parse(JSON.parse(strFromU8(files["data.json"])));
    for (const a of state.attachments)
      if (
        !files["attachments/" + a.storageKey] ||
        files["attachments/" + a.storageKey].length !== a.size
      )
        throw new Error("Копия повреждена: отсутствует документ " + a.name);
    const confirm = await dialog.showMessageBox(window, {
      type: "question",
      buttons: ["Отмена", "Восстановить"],
      defaultId: 0,
      cancelId: 0,
      title: "Восстановление копии",
      message:
        "Текущие записи будут заменены содержимым копии. Сначала сохраните текущую копию, если данные нужны.",
    });
    if (confirm.response !== 1) return null;
    // New keys avoid overwriting existing documents if restoration fails.
    const staged = [];
    try {
      for (const a of state.attachments) {
        const content = files["attachments/" + a.storageKey];
        a.storageKey = randomUUID() + path.extname(a.storageKey);
        fs.writeFileSync(store.attachmentPath(a.storageKey), content, {
          flag: "wx",
        });
        staged.push(a.storageKey);
      }
      return store.save(state);
    } catch (e) {
      for (const key of staged)
        fs.rmSync(store.attachmentPath(key), { force: true });
      throw e;
    }
  });
  handle("weather:search", async (query) => {
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
  });
  handle("weather:get", async (city) => {
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
  });
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#f8f9f6",
    title: "DoIT",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
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
app.on("window-all-closed", () => app.quit());
