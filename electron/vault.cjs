const {
  randomBytes,
  scrypt,
  createCipheriv,
  createDecipheriv,
} = require("node:crypto");
const { promisify } = require("node:util");
const derive = async (password, salt) =>
  promisify(scrypt)(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
const MAGIC = Buffer.from("DOITENC2");
const BACKUP_MAGIC = Buffer.from("DOITBK02");
function encrypt(bytes, key, magic = MAGIC) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), ciphertext]);
}
function decrypt(bytes, key, magic = MAGIC) {
  const data = Buffer.from(bytes);
  if (data.length < 36 || !data.subarray(0, 8).equals(magic))
    throw new Error("Некорректный зашифрованный файл");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(8, 20));
  decipher.setAAD(magic);
  decipher.setAuthTag(data.subarray(20, 36));
  try {
    return Buffer.concat([
      decipher.update(data.subarray(36)),
      decipher.final(),
    ]);
  } catch {
    throw new Error("Неверный пароль или повреждённая копия");
  }
}
function packEncryptedBackup(bytes, key, salt) {
  return Buffer.concat([BACKUP_MAGIC, salt, encrypt(bytes, key)]);
}
async function unpackEncryptedBackup(bytes, password) {
  const data = Buffer.from(bytes);
  if (data.length < 60 || !data.subarray(0, 8).equals(BACKUP_MAGIC))
    throw new Error("Это не резервная копия аккаунта DoIT");
  const salt = data.subarray(8, 24),
    derived = await derive(password, salt);
  try {
    return {
      bytes: decrypt(data.subarray(24), derived.subarray(32)),
      salt: Buffer.from(salt),
      derived,
    };
  } catch (e) {
    derived.fill(0);
    throw e;
  }
}
module.exports = {
  derive,
  encrypt,
  decrypt,
  packEncryptedBackup,
  unpackEncryptedBackup,
};
