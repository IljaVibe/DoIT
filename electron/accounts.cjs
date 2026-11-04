const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, randomBytes, timingSafeEqual } = require("node:crypto");
const { z } = require("zod");
const { Store } = require("./store.cjs");
const { derive } = require("./vault.cjs");
const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  createdAt: z.string(),
  salt: z.string().regex(/^[a-f0-9]{32}$/),
  verifier: z.string().regex(/^[a-f0-9]{64}$/),
});
function atomicJSON(file, value) {
  fs.writeFileSync(file + ".tmp", JSON.stringify(value, null, 2), {
    mode: 0o600,
    flush: true,
  });
  fs.renameSync(file + ".tmp", file);
}
class Accounts {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, "accounts.json");
    this.profiles = fs.existsSync(this.file)
      ? z
          .array(profileSchema)
          .max(50)
          .parse(JSON.parse(fs.readFileSync(this.file, "utf8")))
      : [];
    this.failures = 0;
    this.blockedUntil = 0;
  }
  list() {
    return this.profiles.map(({ id, name, createdAt }) => ({
      id,
      name,
      createdAt,
    }));
  }
  validatePassword(password) {
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 256
    )
      throw new Error("Пароль должен содержать от 8 до 256 символов");
  }
  async create(name, password, legacy) {
    name = z.string().trim().min(1).max(60).parse(name);
    this.validatePassword(password);
    if (this.profiles.length >= 50)
      throw new Error("Можно создать не более 50 аккаунтов");
    if (
      this.profiles.some(
        (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw new Error("Аккаунт с таким именем уже существует");
    const salt = randomBytes(16),
      derived = await derive(password, salt);
    const profile = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      salt: salt.toString("hex"),
      verifier: derived.subarray(0, 32).toString("hex"),
    };
    try {
      return await this.install(
        profile,
        derived,
        legacy
          ? {
              state: legacy.load(),
              attachments: new Map(
                legacy
                  .load()
                  .attachments.map((a) => [
                    a.storageKey,
                    legacy.readAttachment(a.storageKey),
                  ]),
              ),
            }
          : null,
      );
    } catch (e) {
      derived.fill(0);
      throw e;
    }
  }
  async install(profile, derived, content) {
    if (this.profiles.length >= 50)
      throw new Error("Можно создать не более 50 аккаунтов");
    profile = profileSchema.parse(profile);
    if (this.profiles.some((p) => p.id === profile.id))
      profile = {
        ...profile,
        id: randomUUID(),
        name: profile.name.slice(0, 40) + " (восстановлен)",
      };
    const directory = path.join(this.root, "accounts", profile.id);
    let store;
    try {
      store = await new Store().init(directory, derived.subarray(32));
      if (content) {
        for (const a of content.state.attachments)
          store.writeAttachment(
            a.storageKey,
            content.attachments.get(a.storageKey),
          );
        store.save(content.state);
      } else {
        const state = store.load();
        state.settings.name = profile.name;
        store.save(state);
      }
      atomicJSON(this.file, [...this.profiles, profile]);
      this.profiles.push(profile);
      return { store, profile, key: derived.subarray(32) };
    } catch (e) {
      store?.close();
      fs.rmSync(directory, { recursive: true, force: true });
      throw e;
    }
  }
  async login(id, password) {
    if (Date.now() < this.blockedUntil)
      throw new Error("Слишком много попыток. Подождите 30 секунд");
    this.validatePassword(password);
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Аккаунт не найден");
    const derived = await derive(password, Buffer.from(profile.salt, "hex"));
    if (
      !timingSafeEqual(
        derived.subarray(0, 32),
        Buffer.from(profile.verifier, "hex"),
      )
    ) {
      derived.fill(0);
      this.failures++;
      if (this.failures >= 5) {
        this.blockedUntil = Date.now() + 30000;
        this.failures = 0;
      }
      throw new Error("Неверный пароль");
    }
    this.failures = 0;
    try {
      return {
        profile,
        key: derived.subarray(32),
        store: await new Store().init(
          path.join(this.root, "accounts", profile.id),
          derived.subarray(32),
        ),
      };
    } catch (e) {
      derived.fill(0);
      throw e;
    }
  }
}
module.exports = { Accounts, atomicJSON, profileSchema };
