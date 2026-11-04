const { chromium } = require("playwright-core");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.join(__dirname, "../dist");
const server = http.createServer((req, res) => {
  const name = path.join(
    root,
    decodeURIComponent(
      (req.url || "/").split("?")[0] === "/"
        ? "/index.html"
        : req.url.split("?")[0],
    ),
  );
  if (!name.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      name.endsWith(".js")
        ? "application/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : "text/html; charset=utf-8",
    );
    res.end(fs.readFileSync(name));
  } catch {
    res.writeHead(404).end();
  }
});
let browser;
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (process.platform === "linux"
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel("Как к вам обращаться?").fill("Алекс");
  await page
    .getByRole("button", { name: "Сначала посмотреть на примере" })
    .click();
  await page.getByRole("heading", { name: "Хорошего дня, Алекс" }).waitFor();
  fs.mkdirSync(path.join(__dirname, "../test-results"), { recursive: true });
  await page.screenshot({
    path: path.join(__dirname, "../test-results/today.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Быстрая задача", { exact: true })
    .fill("Проверить быстрый ввод");
  await page.getByLabel("Быстрая задача", { exact: true }).press("Enter");
  await page
    .locator(".task-content")
    .filter({ hasText: "Проверить быстрый ввод" })
    .click();
  await page.getByLabel("Описание задачи").fill("Сохраняем описание и шаги");
  await page.getByLabel("Новая подзадача").fill("Проверить календарь");
  await page.getByLabel("Новая подзадача").press("Enter");
  await page
    .getByRole("button", { name: "Сохранить задачу", exact: true })
    .click();
  await page.reload();
  await page
    .locator(".task-content")
    .filter({ hasText: "Проверить быстрый ввод" })
    .waitFor();
  await page
    .getByLabel("Завершить задачу: Проверить быстрый ввод", { exact: true })
    .click();
  await page.getByRole("button", { name: /Выполнено/ }).click();
  assert(
    await page
      .getByLabel("Вернуть задачу: Проверить быстрый ввод", { exact: true })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Входящие", exact: true }).click();
  await page
    .getByLabel("Быстрая задача", { exact: true })
    .fill("Входящая задача");
  await page.getByLabel("Быстрая задача", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await page.locator(".calendar-grid").waitFor();
  assert.equal(await page.locator(".calendar-cell").count(), 42);
  await page.getByLabel("Следующий месяц").click();
  await page.getByLabel("Предыдущий месяц").click();
  await page.screenshot({
    path: path.join(__dirname, "../test-results/calendar.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Цели", exact: true }).click();
  await page.getByRole("button", { name: "Новая цель", exact: true }).click();
  await page.getByLabel("К чему вы хотите прийти?").fill("Проверенная цель");
  await page
    .getByRole("button", { name: "Сохранить цель", exact: true })
    .click();
  const goal = page
    .locator(".goal-card")
    .filter({ hasText: "Проверенная цель" });
  await goal.getByRole("button", { name: "1 шагов", exact: true }).click();
  assert((await goal.innerText()).includes("10%"));
  await page
    .getByRole("button", { name: "Заметки и идеи", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Новая заметка", exact: true })
    .click();
  await page.getByLabel("Заголовок заметки").fill("Моя проверенная идея");
  await page.getByLabel("Текст заметки").fill("Всё важное сохраняется.");
  await page.getByRole("button", { name: "Идея", exact: true }).click();
  await page
    .getByRole("button", { name: "Сохранить заметку", exact: true })
    .click();
  await page
    .locator(".note-card")
    .filter({ hasText: "Моя проверенная идея" })
    .waitFor();
  await page.screenshot({
    path: path.join(__dirname, "../test-results/notes.png"),
    fullPage: true,
  });
  await page.getByLabel("Поиск по всему пространству").fill("Моя проверенная");
  await page
    .locator(".search-results")
    .getByRole("button", { name: /Моя проверенная идея/ })
    .click();
  await page.getByLabel("Текст заметки").waitFor();
  await page.getByLabel("Закрыть", { exact: true }).click();
  await page.getByRole("button", { name: "База задач", exact: true }).click();
  await page.getByLabel("Статус задач").selectOption("completed");
  assert(
    (await page.locator("tbody").innerText()).includes(
      "Проверить быстрый ввод",
    ),
  );
  await page.getByLabel("Создать проект").click();
  await page.getByLabel("Название", { exact: true }).fill("Новый проект");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Создать проект", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Новый проект", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Настройки/ }).click();
  await page.getByLabel("Ваше имя", { exact: true }).fill("Мария");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByLabel("Закрыть", { exact: true }).click();
  await page.getByRole("button", { name: /Мой день/ }).click();
  await page.getByRole("heading", { name: "Хорошего дня, Мария" }).waitFor();
  await page.setViewportSize({ width: 1000, height: 740 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(__dirname, "../test-results/compact.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "UI smoke: onboarding, tasks, subtasks, completion, persistence, inbox, calendar, goals, notes, search, database filters, projects, settings, compact layout — PASS",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.close();
  });
