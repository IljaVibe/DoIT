const path = require("node:path");
const { spawnSync } = require("node:child_process");
const installer = path.join(
  path.dirname(require.resolve("electron/package.json")),
  "install.js",
);
const result = spawnSync(process.execPath, [installer], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(process.env.HTTPS_PROXY ? { ELECTRON_GET_USE_PROXY: "1" } : {}),
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
