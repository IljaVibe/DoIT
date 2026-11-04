const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js");
const { stateSchema } = require("./schema.cjs");
const { encrypt, decrypt } = require("./vault.cjs");
const emptyState = () => ({
  version: 1,
  tasks: [],
  notes: [],
  goals: [],
  projects: [],
  attachments: [],
  settings: { name: "", city: null, onboardingDone: false, theme: "sage" },
});
class Store {
  async init(directory, key = null) {
    this.directory = directory;
    this.key = key;
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, key ? "doit.vault" : "doit.sqlite");
    const SQL = await initSqlJs();
    this.db = fs.existsSync(this.file)
      ? new SQL.Database(
          key
            ? decrypt(fs.readFileSync(this.file), key)
            : fs.readFileSync(this.file),
        )
      : new SQL.Database();
    this.db.run(
      "CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
    );
    fs.mkdirSync(path.join(directory, "attachments"), { recursive: true });
    this.load();
    return this;
  }
  load() {
    const result = this.db.exec("SELECT data FROM state WHERE id=1");
    return result.length
      ? stateSchema.parse(JSON.parse(result[0].values[0][0]))
      : emptyState();
  }
  save(input) {
    const state = stateSchema.parse(input);
    const previous = this.load();
    try {
      this.db.run("INSERT OR REPLACE INTO state (id,data) VALUES (1,?)", [
        JSON.stringify(state),
      ]);
      const bytes = this.db.export();
      fs.writeFileSync(
        this.file + ".tmp",
        this.key ? encrypt(Buffer.from(bytes), this.key) : Buffer.from(bytes),
        { mode: 0o600, flush: true },
      );
      fs.renameSync(this.file + ".tmp", this.file);
    } catch (error) {
      this.db.run("INSERT OR REPLACE INTO state (id,data) VALUES (1,?)", [
        JSON.stringify(previous),
      ]);
      throw error;
    }
    return state;
  }
  attachmentPath(key) {
    if (!/^[a-f0-9-]{36}(\.[a-z0-9]{1,12})?$/.test(key))
      throw new Error("Недопустимое имя файла");
    return path.join(this.directory, "attachments", key);
  }
  readAttachment(key) {
    const bytes = fs.readFileSync(this.attachmentPath(key));
    return this.key ? decrypt(bytes, this.key) : bytes;
  }
  writeAttachment(key, bytes) {
    fs.writeFileSync(
      this.attachmentPath(key),
      this.key ? encrypt(bytes, this.key) : bytes,
      { flag: "wx", mode: 0o600 },
    );
  }
  close() {
    this.db.close();
  }
}
module.exports = { Store, emptyState };
