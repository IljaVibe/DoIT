const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const {
  getMakeNsisPath,
  getNsisPluginsPath,
} = require("app-builder-lib/out/toolsets/windows");
const { getPath7za } = require("app-builder-lib/out/toolsets/7zip");
const root = path.resolve(__dirname, ".."),
  version = require("../package.json").version;
const release = path.join(root, "release"),
  appDir = path.join(release, "win-unpacked");
function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(path.basename(file) + " exited with " + code)),
    );
  });
}
const escape = (s) => s.replace(/\$/g, "$$").replace(/"/g, '$\\"');
function walk(dir, prefix = "") {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(dir, e.name), prefix + e.name + "\\")
        : [prefix + e.name],
    );
}
(async () => {
  const [nsis, plugins, seven] = await Promise.all([
    getMakeNsisPath(),
    getNsisPluginsPath(),
    getPath7za(),
  ]);
  const payload = path.join(release, `DoIT-${version}-payload.7z`);
  fs.rmSync(payload, { force: true });
  await run(
    seven,
    ["a", "-t7z", "-mx=9", "-m0=LZMA2", "-md=64m", "-mmt=2", payload, "."],
    { cwd: appDir },
  );
  await run(seven, ["t", payload]);
  const bytes = fs.readFileSync(payload),
    hash = crypto
      .createHash("sha256")
      .update(bytes)
      .digest("hex")
      .toUpperCase();
  const files = walk(appDir),
    dirs = [
      ...new Set(
        files.flatMap((f) => {
          const d = f.split("\\");
          d.pop();
          return d.map((_, i) => d.slice(0, i + 1).join("\\"));
        }),
      ),
    ].sort((a, b) => b.length - a.length);
  const deletes =
    files.map((f) => `  Delete "$INSTDIR\\${escape(f)}"`).join("\n") +
    "\n" +
    dirs.map((d) => `  RMDir "$INSTDIR\\${escape(d)}"`).join("\n");
  const include = path
    .join(root, "node_modules/app-builder-lib/templates/nsis/include")
    .replaceAll("\\", "/");
  const script = `Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!addincludedir "${include}"
!include "StdUtils.nsh"
!addplugindir /x86-unicode "${plugins.replaceAll("\\", "/")}/x86-unicode"
Name "DoIT"
OutFile "\${OUTPUT}"
InstallDir "$LOCALAPPDATA\\Programs\\DoIT"
InstallDirRegKey HKCU "Software\\DoIT" "InstallDir"
RequestExecutionLevel user
SetCompressor lzma
VIProductVersion "${version}.0"
VIAddVersionKey /LANG=1049 "ProductName" "DoIT"
VIAddVersionKey /LANG=1049 "FileDescription" "Установка DoIT"
VIAddVersionKey /LANG=1049 "FileVersion" "${version}"
VIAddVersionKey /LANG=1049 "LegalCopyright" "DoIT"
!define MUI_ICON "${path.join(root, "build/icon.ico")}"
!define MUI_UNICON "${path.join(root, "build/icon.ico")}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\\DoIT.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  SetShellVarContext current
  SetRegView 64
  \${IfNot} \${RunningX64}
    MessageBox MB_ICONSTOP "Требуется 64-разрядная Windows 10 или новее."
    Abort
  \${EndIf}
  check_running:
  nsProcess::_FindProcess "DoIT.exe"
  Pop $0
  StrCmp $0 0 0 running_ok
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Перед установкой закройте DoIT через меню значка в трее → Выйти из DoIT." IDRETRY check_running
    Abort
  running_ok:
FunctionEnd
Section "DoIT"
  InitPluginsDir
  SetCompress off
  File /oname=$PLUGINSDIR\\app.7z "${payload}"
  SetCompress auto
  \${StdUtils.HashFile} $0 "SHA2-256" "$PLUGINSDIR\\app.7z"
  StrCmp $0 "${hash}" hash_ok
    MessageBox MB_ICONSTOP "Контрольная сумма не совпадает. Файлы повреждены, установка остановлена."
    Abort
  hash_ok:
  SetOutPath "$INSTDIR"
  ClearErrors
  Nsis7z::Extract "$PLUGINSDIR\\app.7z"
  IfErrors extract_failed
  IfFileExists "$INSTDIR\\DoIT.exe" 0 extract_failed
  IfFileExists "$INSTDIR\\resources\\app.asar" 0 extract_failed
  WriteUninstaller "$INSTDIR\\Uninstall DoIT.exe"
  WriteRegStr HKCU "Software\\DoIT" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "DisplayName" "DoIT"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "DisplayVersion" "${version}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "UninstallString" '$\\"$INSTDIR\\Uninstall DoIT.exe$\\"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "DisplayIcon" "$INSTDIR\\DoIT.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT" "NoRepair" 1
  CreateShortcut "$DESKTOP\\DoIT.lnk" "$INSTDIR\\DoIT.exe"
  CreateDirectory "$SMPROGRAMS\\DoIT"
  CreateShortcut "$SMPROGRAMS\\DoIT\\DoIT.lnk" "$INSTDIR\\DoIT.exe"
  Goto install_ok
  extract_failed:
    MessageBox MB_ICONSTOP "Не удалось распаковать DoIT. Проверьте свободное место и права на папку."
    Abort
  install_ok:
SectionEnd
Function un.onInit
  SetShellVarContext current
  SetRegView 64
  un_check:
  nsProcess::_FindProcess "DoIT.exe"
  Pop $0
  StrCmp $0 0 0 un_ok
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Перед удалением закройте DoIT через меню значка в трее → Выйти из DoIT." IDRETRY un_check
    Abort
  un_ok:
FunctionEnd
Section "Uninstall"
  Delete "$DESKTOP\\DoIT.lnk"
  Delete "$SMPROGRAMS\\DoIT\\DoIT.lnk"
  RMDir "$SMPROGRAMS\\DoIT"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DoIT"
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "DoIT"
  DeleteRegKey HKCU "Software\\DoIT"
${deletes}
  Delete "$INSTDIR\\Uninstall DoIT.exe"
  RMDir "$INSTDIR"
  ; Account data in APPDATA is deliberately retained.
SectionEnd
`;
  const file = path.join(release, "installer.generated.nsi");
  fs.writeFileSync(file, script);
  const output = path.join(release, `DoIT-Setup-${version}-x64.exe`);
  await run(
    nsis.path,
    ["-V3", "-INPUTCHARSET", "UTF8", `-DOUTPUT=${output}`, file],
    { env: { ...process.env, ...nsis.env } },
  );
  const sum = crypto
    .createHash("sha256")
    .update(fs.readFileSync(output))
    .digest("hex");
  fs.writeFileSync(output + ".sha256", `${sum}  ${path.basename(output)}\n`);
  console.log("Offline installer created:", output);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
