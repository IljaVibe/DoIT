const fs = require("node:fs");
const path = require("node:path");
const { zipSync, unzipSync, strToU8, strFromU8 } = require("fflate");
const { stateSchema } = require("./schema.cjs");
const { profileSchema } = require("./accounts.cjs");
const { packEncryptedBackup, unpackEncryptedBackup } = require("./vault.cjs");
const MAX_BACKUP = 250 * 1024 * 1024;
function archive(store, profile = null) {
  const state = store.load(),
    files = { "data.json": strToU8(JSON.stringify(state)) };
  if (profile)
    files["profile.json"] = strToU8(
      JSON.stringify({
        id: profile.id,
        name: profile.name,
        createdAt: profile.createdAt,
      }),
    );
  let total = files["data.json"].length;
  for (const a of state.attachments) {
    const bytes = store.readAttachment(a.storageKey);
    total += bytes.length;
    if (total > MAX_BACKUP) throw new Error("Копия превышает 250 МБ");
    files["attachments/" + a.storageKey] = bytes;
  }
  return Buffer.from(zipSync(files));
}
function parseArchive(bytes) {
  if (bytes.length > MAX_BACKUP + 1024 * 1024)
    throw new Error("Копия превышает 250 МБ");
  let expanded = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > MAX_BACKUP)
        throw new Error("Распакованная копия превышает 250 МБ");
      return true;
    },
  });
  if (!files["data.json"]) throw new Error("В копии нет данных DoIT");
  const state = stateSchema.parse(JSON.parse(strFromU8(files["data.json"]))),
    attachments = new Map();
  for (const a of state.attachments) {
    const file = files["attachments/" + a.storageKey];
    if (!file || file.length !== a.size)
      throw new Error("В копии отсутствует документ " + a.name);
    attachments.set(a.storageKey, Buffer.from(file));
  }
  return {
    state,
    attachments,
    profile: files["profile.json"]
      ? JSON.parse(strFromU8(files["profile.json"]))
      : null,
  };
}
function accountBackup(active) {
  return packEncryptedBackup(
    archive(active.store, active.profile),
    active.key,
    Buffer.from(active.profile.salt, "hex"),
  );
}
async function restoreAccount(bytes, password, accounts) {
  accounts.validatePassword(password);
  const unpacked = await unpackEncryptedBackup(bytes, password);
  try {
    const content = parseArchive(unpacked.bytes);
    const profile = profileSchema.parse({
      ...content.profile,
      salt: unpacked.salt.toString("hex"),
      verifier: unpacked.derived.subarray(0, 32).toString("hex"),
    });
    return await accounts.install(profile, unpacked.derived, content);
  } catch (e) {
    unpacked.derived.fill(0);
    throw e;
  }
}
function writeAutomaticBackup(active, folder) {
  if (!fs.statSync(folder).isDirectory())
    throw new Error("Папка копий недоступна");
  const file = path.join(folder, `DoIT-${active.profile.id}-latest.doit`),
    bytes = accountBackup(active);
  fs.writeFileSync(file + ".tmp", bytes, { mode: 0o600, flush: true });
  if (fs.existsSync(file))
    fs.copyFileSync(file, file.replace("-latest.doit", "-previous.doit"));
  fs.renameSync(file + ".tmp", file);
}
module.exports = {
  MAX_BACKUP,
  archive,
  parseArchive,
  accountBackup,
  restoreAccount,
  writeAutomaticBackup,
};
