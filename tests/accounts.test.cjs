const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { Store, emptyState } = require("../electron/store.cjs");
const { Accounts } = require("../electron/accounts.cjs");
const {
  accountBackup,
  restoreAccount,
  writeAutomaticBackup,
} = require("../electron/backup.cjs");
function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doit-account-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
const password = "test-only-passphrase";
test("Изменённые размеры виджета на большом мониторе не ломают запуск", () => {
  const { configSchema } = require("../electron/desktop.cjs");
  const prefs = configSchema.parse({
    bounds: { note: { x: 100, y: 100, width: 1800, height: 1400 } },
  });
  assert.equal(prefs.bounds.note.width, 1800);
});
test("Аккаунт шифрует базу и документы; повторный вход требует пароль", async (t) => {
  const root = directory(t),
    accounts = new Accounts(root),
    active = await accounts.create("Личный", password, null),
    state = active.store.load();
  const key = randomUUID() + ".txt",
    secret = "Секретные заметки и планы";
  active.store.writeAttachment(key, Buffer.from(secret));
  state.notes.push({
    id: randomUUID(),
    title: secret,
    body: "Приватные мысли",
    kind: "note",
    pinned: true,
    updatedAt: new Date().toISOString(),
  });
  state.attachments.push({
    id: randomUUID(),
    name: "Личный.txt",
    storageKey: key,
    size: Buffer.byteLength(secret),
    taskId: "",
    addedAt: new Date().toISOString(),
  });
  active.store.save(state);
  assert(!fs.readFileSync(active.store.file).includes(Buffer.from(secret)));
  assert(
    !fs
      .readFileSync(active.store.attachmentPath(key))
      .includes(Buffer.from(secret)),
  );
  assert(
    !fs
      .readFileSync(path.join(root, "accounts.json"), "utf8")
      .includes(password),
  );
  active.store.close();
  active.key.fill(0);
  await assert.rejects(
    accounts.login(active.profile.id, "incorrect-pass"),
    /Неверный пароль/,
  );
  const next = await new Accounts(root).login(active.profile.id, password);
  assert.equal(next.store.load().notes[0].title, secret);
  assert.equal(next.store.readAttachment(key).toString(), secret);
  next.store.close();
});
test("Зашифрованная копия восстанавливает аккаунт и документы на другом компьютере", async (t) => {
  const root = directory(t),
    other = directory(t),
    accounts = new Accounts(root),
    active = await accounts.create("Копия", password, null);
  const state = active.store.load(),
    key = randomUUID() + ".pdf",
    bytes = Buffer.from("test-document");
  active.store.writeAttachment(key, bytes);
  state.settings.theme = "graphite";
  state.attachments.push({
    id: randomUUID(),
    name: "План.pdf",
    storageKey: key,
    size: bytes.length,
    taskId: "",
    addedAt: "",
  });
  active.store.save(state);
  const backup = accountBackup(active);
  assert(!backup.includes(bytes));
  await assert.rejects(
    restoreAccount(backup, "incorrect-pass", new Accounts(other)),
    /Неверный пароль/,
  );
  const corrupted = Buffer.from(backup);
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(
    restoreAccount(corrupted, password, new Accounts(other)),
    /повреждённая копия/,
  );
  const restored = await restoreAccount(backup, password, new Accounts(other));
  assert.equal(restored.profile.name, "Копия");
  assert.equal(restored.store.load().settings.theme, "graphite");
  assert.deepEqual(restored.store.readAttachment(key), bytes);
  restored.store.close();
  const freshLogin = await new Accounts(other).login(
    restored.profile.id,
    password,
  );
  assert.equal(freshLogin.store.load().attachments.length, 1);
  freshLogin.store.close();
  active.store.close();
});
test("Автоматические копии сохраняют предыдущую версию и показывают недоступную папку", async (t) => {
  const root = directory(t),
    folder = directory(t),
    active = await new Accounts(root).create("Резерв", password, null);
  writeAutomaticBackup(active, folder);
  const state = active.store.load();
  state.settings.name = "Новое имя";
  active.store.save(state);
  writeAutomaticBackup(active, folder);
  const files = fs.readdirSync(folder);
  assert(files.some((f) => f.endsWith("-latest.doit")));
  assert(files.some((f) => f.endsWith("-previous.doit")));
  assert.throws(() => writeAutomaticBackup(active, path.join(root, "missing")));
  active.store.close();
});
test("Миграция сохраняет гостевые записи, а старые копии получают тему по умолчанию", async (t) => {
  const root = directory(t),
    legacy = await new Store().init(root),
    state = emptyState();
  state.settings.name = "Старый профиль";
  state.notes.push({
    id: randomUUID(),
    title: "Из первой версии",
    body: "Не потерять",
    kind: "note",
    pinned: false,
    updatedAt: "",
  });
  delete state.settings.theme;
  legacy.save(state);
  const active = await new Accounts(root).create(
    "Новый аккаунт",
    password,
    legacy,
  );
  assert.equal(active.store.load().notes[0].title, "Из первой версии");
  assert.equal(active.store.load().settings.theme, "sage");
  assert.equal(legacy.load().notes.length, 1);
  active.store.close();
  legacy.close();
});
