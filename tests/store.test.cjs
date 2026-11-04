const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Store, emptyState } = require("../electron/store.cjs");
const { stateSchema, citySchema } = require("../electron/schema.cjs");
const task = () => ({
  id: randomUUID(),
  title: "Написать план",
  description: "Личные заметки 🌱",
  date: "2026-11-04",
  priority: "high",
  projectId: "",
  completed: false,
  createdAt: new Date().toISOString(),
  subtasks: [{ id: randomUUID(), title: "Первый шаг", completed: true }],
});
test("SQLite сохраняет записи, Unicode и подзадачи после повторного открытия", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "doit-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = await new Store().init(dir);
  assert.deepEqual(store.load(), emptyState());
  const state = emptyState();
  state.tasks.push(task());
  store.save(state);
  assert.equal(
    readFileSync(path.join(dir, "doit.sqlite")).subarray(0, 15).toString(),
    "SQLite format 3",
  );
  const reopened = await new Store().init(dir);
  assert.deepEqual(reopened.load(), state);
  state.tasks[0].completed = true;
  state.tasks[0].date = "2026-11-05";
  reopened.save(state);
  const final = await new Store().init(dir);
  assert.equal(final.load().tasks[0].completed, true);
  assert.equal(final.load().tasks[0].date, "2026-11-05");
  state.tasks = [];
  final.save(state);
  assert.equal((await new Store().init(dir)).load().tasks.length, 0);
});
test("Неправильные данные не заменяют сохранённую базу", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "doit-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = await new Store().init(dir);
  const state = emptyState();
  state.tasks.push(task());
  store.save(state);
  assert.throws(() =>
    store.save({ ...state, tasks: [{ ...state.tasks[0], title: "" }] }),
  );
  assert.deepEqual(store.load(), state);
});
test("Отклоняются повторяющиеся ID, невозможные даты и опасные пути вложений", () => {
  const state = emptyState(),
    t = task();
  assert.equal(
    stateSchema.safeParse({ ...state, tasks: [t, t] }).success,
    false,
  );
  assert.equal(
    stateSchema.safeParse({ ...state, tasks: [{ ...t, date: "2026-02-30" }] })
      .success,
    false,
  );
  assert.equal(
    stateSchema.safeParse({
      ...state,
      attachments: [
        {
          id: randomUUID(),
          name: "doc",
          size: 1,
          storageKey: "../../secret",
          taskId: "",
          addedAt: "",
        },
      ],
    }).success,
    false,
  );
  const store = new Store();
  store.directory = "/tmp";
  assert.throws(() => store.attachmentPath("../secret"));
});
test("Прогресс цели ограничен целью; координаты города проверяются", () => {
  const state = emptyState(),
    g = {
      id: randomUUID(),
      title: "Чтение",
      description: "",
      progress: 11,
      target: 10,
      unit: "книг",
      deadline: "",
    };
  assert.equal(stateSchema.safeParse({ ...state, goals: [g] }).success, false);
  assert.equal(
    citySchema.safeParse({ name: "Прага", latitude: 50.08, longitude: 14.42 })
      .success,
    true,
  );
  assert.equal(
    citySchema.safeParse({ name: "Ошибка", latitude: 100, longitude: 14 })
      .success,
    false,
  );
});
