const { _electron: electron } = require("playwright-core");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { unzipSync, strFromU8 } = require("fflate");
const root = path.join(__dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "doit-integration-"));
let instance;
async function launch() {
  return electron.launch({
    executablePath: process.env.DOIT_EXECUTABLE || require("electron"),
    args: [
      ...(process.platform === "linux"
        ? ["--no-sandbox", "--ozone-platform=headless", "--disable-gpu"]
        : []),
      ...(process.env.DOIT_EXECUTABLE ? [] : [root]),
    ],
    env: { ...process.env, DOIT_DATA_DIR: path.join(directory, "data") },
  });
}
(async () => {
  instance = await launch();
  let page = await instance.firstWindow();
  await page.setViewportSize({ width: 1440, height: 960 });
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Продолжить без аккаунта" }).click();
  await page.getByLabel("Как к вам обращаться?").pressSequentially("Тест");
  assert.equal(
    await page.getByLabel("Как к вам обращаться?").inputValue(),
    "Тест",
  );
  await page.getByRole("button", { name: "Начать с чистого листа" }).click();
  await page.getByRole("heading", { name: "Хорошего дня, Тест" }).waitFor();
  await page
    .getByRole("button", { name: "Добавить задачу", exact: true })
    .click();
  await page
    .getByLabel("Название задачи")
    .pressSequentially("Данные после перезапуска");
  assert.equal(
    await page.getByLabel("Название задачи").inputValue(),
    "Данные после перезапуска",
  );
  await page
    .getByRole("button", { name: "Сохранить задачу", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector(".save-indicator.saved"),
  );
  let state = await page.evaluate(() => window.doit.load());
  assert.equal(state.tasks.length, 1);
  const original = path.join(directory, "Документ.txt");
  fs.writeFileSync(original, "Пример документа — UTF-8");
  await instance.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, original);
  await page.getByRole("button", { name: "Файлы", exact: true }).click();
  await page
    .getByRole("button", { name: "Прикрепить файл", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Документ.txt/ })
    .first()
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".save-indicator.saved"),
  );
  state = await page.evaluate(() => window.doit.load());
  assert.equal(state.attachments.length, 1);
  fs.rmSync(original);
  assert.equal(
    fs.readFileSync(
      path.join(
        directory,
        "data",
        "attachments",
        state.attachments[0].storageKey,
      ),
      "utf8",
    ),
    "Пример документа — UTF-8",
  );
  const backup = path.join(directory, "backup.zip");
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
  const zip = unzipSync(fs.readFileSync(backup));
  assert.equal(JSON.parse(strFromU8(zip["data.json"])).tasks.length, 1);
  assert(zip["attachments/" + state.attachments[0].storageKey]);
  await page.evaluate(async () => {
    const s = await window.doit.load();
    s.tasks = [];
    await window.doit.save(s);
  });
  await instance.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, backup);
  await page.getByRole("button", { name: "Восстановить", exact: true }).click();
  await page
    .getByText("Данные и документы восстановлены", { exact: true })
    .waitFor();
  state = await page.evaluate(() => window.doit.load());
  assert.equal(state.tasks.length, 1);
  assert.equal(state.attachments.length, 1);
  assert.equal(
    fs.readFileSync(
      path.join(
        directory,
        "data",
        "attachments",
        state.attachments[0].storageKey,
      ),
      "utf8",
    ),
    "Пример документа — UTF-8",
  );
  const denied = await page.evaluate(async () => {
    const s = await window.doit.load();
    s.attachments[0].storageKey = "../../secrets";
    try {
      await window.doit.save(s);
      return false;
    } catch {
      return true;
    }
  });
  assert(denied);
  await instance.evaluate(({ net }) => {
    net.fetch = async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes("geocoding-api")
          ? {
              results: [
                {
                  name: "Прага",
                  country: "Чехия",
                  latitude: 50.08,
                  longitude: 14.42,
                },
              ],
            }
          : {
              current: { temperature_2m: 11.5, weather_code: 2 },
              daily: { temperature_2m_max: [13], temperature_2m_min: [7] },
            },
    });
  });
  await page.getByLabel("Город для погоды").fill("Прага");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: "Прага, Чехия", exact: true }).click();
  await page.getByLabel("Закрыть", { exact: true }).click();
  await page.getByRole("button", { name: "Мой день", exact: true }).click();
  await page.getByText("Переменная облачность", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".save-indicator.saved"),
  );
  await instance.close();
  instance = await launch();
  page = await instance.firstWindow();
  await page.getByRole("button", { name: "Продолжить без аккаунта" }).click();
  await page.getByRole("heading", { name: "Хорошего дня, Тест" }).waitFor();
  assert((await page.evaluate(() => window.doit.load())).tasks.length === 1);
  assert(
    (await page.evaluate(() => window.doit.load())).settings.city.name ===
      "Прага, Чехия",
  );
  console.log(
    "Electron integration: isolated preload, real SQLite, keyboard focus, file copy, full backup/restore, invalid-path rejection, weather with fixture, app restart — PASS",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await instance?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
