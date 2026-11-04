const { _electron: electron } = require("playwright-core");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.join(__dirname, ".."),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "doit-new-features-")),
  data = path.join(dir, "data"),
  folder = path.join(dir, "copies");
fs.mkdirSync(folder);
let instance;
const launch = () =>
  electron.launch({
    executablePath: process.env.DOIT_EXECUTABLE || require("electron"),
    args: [
      ...(process.platform === "linux"
        ? ["--no-sandbox", "--ozone-platform=headless", "--disable-gpu"]
        : []),
      ...(process.env.DOIT_EXECUTABLE ? [] : [root]),
    ],
    env: { ...process.env, DOIT_DATA_DIR: data },
  });
const password = "test-only-passphrase";
(async () => {
  instance = await launch();
  let page = await instance.firstWindow();
  await page.setViewportSize({ width: 1440, height: 960 });
  page.on("dialog", (d) => d.accept());
  assert(
    await page.evaluate(async () => {
      try {
        await window.doit.load();
        return false;
      } catch {
        return true;
      }
    }),
  );
  await page.getByLabel("Имя аккаунта", { exact: true }).fill("Ирина");
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByLabel("Повторите пароль", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Создать локальный аккаунт", exact: true })
    .click();
  await page.getByLabel("Как к вам обращаться?").fill("Ирина");
  await page
    .getByRole("button", { name: "Сначала посмотреть на примере" })
    .click();
  await page.getByRole("heading", { name: "Хорошего дня, Ирина" }).waitFor();
  const colors = new Set();
  fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
  for (const [theme, label] of [
    ["sage", "Шалфей"],
    ["sand", "Песок"],
    ["mist", "Туман"],
    ["lavender", "Лаванда"],
    ["graphite", "Графит"],
  ]) {
    await page.getByRole("button", { name: /Настройки/ }).click();
    await page
      .getByRole("button", { name: "Тема " + label, exact: true })
      .click();
    await page.waitForFunction(
      (theme) => document.documentElement.dataset.theme === theme,
      theme,
    );
    await page.getByLabel("Закрыть", { exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector(".save-indicator.saved"),
    );
    colors.add(
      await page
        .locator(".sidebar")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    await page.screenshot({
      path: path.join(root, "test-results/theme-" + theme + ".png"),
      fullPage: true,
    });
  }
  assert.equal(colors.size, 5);
  await instance.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, folder);
  await page.getByRole("button", { name: /Настройки/ }).click();
  await page
    .getByRole("button", { name: "Выбрать папку", exact: true })
    .click();
  await page.getByText("Изменить папку", { exact: true }).waitFor();
  const prefs = await page.evaluate(() => window.doit.desktopPreferences());
  assert(prefs.backupLastAt);
  assert(fs.readdirSync(folder).some((f) => f.endsWith(".doit")));
  await page.getByLabel("Задачи на сегодня", { exact: false }).check();
  await page.getByLabel("Прогресс целей", { exact: false }).check();
  await page.getByLabel("Заметка и быстрые мысли", { exact: false }).check();
  await page
    .getByLabel("Закрепить поверх других окон", { exact: false })
    .check();
  await page
    .getByLabel("При закрытии оставлять в трее", { exact: false })
    .check();
  await page.getByLabel("Закрыть", { exact: true }).click();
  let widgets = [];
  for (let tries = 0; tries < 30; tries++) {
    widgets = instance.windows().filter((p) => p.url().includes("widget="));
    if (widgets.length === 3) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(widgets.length, 3);
  const tasks = widgets.find((p) => p.url().includes("widget=tasks"));
  await tasks.getByLabel("Задача из виджета").fill("Дело из виджета");
  await tasks.getByLabel("Добавить", { exact: true }).click();
  await page.getByText("Дело из виджета", { exact: true }).waitFor();
  await page
    .locator(".task-content")
    .filter({ hasText: "Дело из виджета" })
    .click();
  await page
    .getByLabel("Описание задачи")
    .fill("Изменение одновременно с виджетом");
  await page.waitForFunction(() =>
    document.querySelector(".save-indicator.saved"),
  );
  await tasks.getByLabel("Завершить: Дело из виджета", { exact: true }).click();
  await page
    .getByRole("button", { name: "Сохранить задачу", exact: true })
    .click();
  await page.waitForFunction(
    async () =>
      (await window.doit.load()).tasks.find(
        (t) => t.title === "Дело из виджета",
      )?.completed,
  );
  const goals = widgets.find((p) => p.url().includes("widget=goals")),
    before = (await page.evaluate(() => window.doit.load())).goals[0].progress;
  await goals
    .getByLabel(/^Шаг к цели:/)
    .first()
    .click();
  await page.waitForFunction(
    async (before) =>
      (await window.doit.load()).goals[0].progress === before + 1,
    before,
  );
  const note = widgets.find((p) => p.url().includes("widget=note"));
  await note.getByLabel("Заметка из виджета").fill("Мысль с рабочего стола");
  await note.getByLabel("Добавить", { exact: true }).click();
  await page.waitForFunction(async () =>
    (await window.doit.load()).notes.some(
      (n) => n.title === "Мысль с рабочего стола",
    ),
  );
  await tasks.screenshot({
    path: path.join(root, "test-results/widget-tasks.png"),
  });
  const backup = path.join(dir, "account.doit");
  await instance.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, backup);
  await page.getByRole("button", { name: /Настройки/ }).click();
  await page
    .getByRole("button", { name: "Сохранить копию", exact: true })
    .click();
  await page
    .getByText("Копия с документами сохранена", { exact: true })
    .waitFor();
  await page
    .getByRole("button", {
      name: "Заблокировать / сменить аккаунт",
      exact: true,
    })
    .click();
  await page.getByRole("heading", { name: "С возвращением." }).waitFor();
  assert.equal(
    instance.windows().filter((p) => p.url().includes("widget=")).length,
    0,
  );
  assert(
    await page.evaluate(async () => {
      try {
        await window.doit.load();
        return false;
      } catch {
        return true;
      }
    }),
  );
  await page.getByLabel("Пароль", { exact: true }).fill("incorrect-pass");
  await page
    .getByRole("button", { name: "Открыть пространство", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Открыть пространство", exact: true })
    .click();
  await page.getByRole("heading", { name: "Хорошего дня, Ирина" }).waitFor();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "graphite",
  );
  assert(
    (await page.evaluate(() => window.doit.desktopPreferences())).alwaysOnTop,
  );
  // Full restart retains the account but requires its password again.
  await instance.close();
  instance = await launch();
  page = await instance.firstWindow();
  await page.getByRole("heading", { name: "С возвращением." }).waitFor();
  await page.getByRole("button", { name: "Из копии", exact: true }).click();
  await page.getByLabel("Пароль от резервной копии").fill(password);
  await instance.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, backup);
  await page
    .getByRole("button", { name: "Выбрать копию и восстановить", exact: true })
    .click();
  await page.getByRole("heading", { name: "Хорошего дня, Ирина" }).waitFor();
  assert.equal(
    (await page.evaluate(() => window.doit.authInfo())).accounts.length,
    2,
  );
  console.log(
    "Accounts desktop: registration, locked IPC, five themes, encrypted automatic backup, three widgets with live edits, lock/unlock, wrong password, preference persistence, restart and recovery — PASS",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await instance?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
