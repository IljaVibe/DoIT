import { useEffect, useState } from "react";
import {
  FolderOpen,
  HardDrive,
  LayoutGrid,
  LockKeyhole,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import type { DesktopPreferences, State, Theme } from "./model";
import { useAccount } from "./Account";
export const themes: { id: Theme; name: string; colors: string[] }[] = [
  { id: "sage", name: "Шалфей", colors: ["#f7f9f3", "#e4eadc", "#526c4d"] },
  { id: "sand", name: "Песок", colors: ["#faf7f2", "#e9ded0", "#886f56"] },
  { id: "mist", name: "Туман", colors: ["#f3f7fa", "#dce6ee", "#577588"] },
  {
    id: "lavender",
    name: "Лаванда",
    colors: ["#f8f5fb", "#e7dff0", "#80668f"],
  },
  { id: "graphite", name: "Графит", colors: ["#20242a", "#303740", "#b2bdac"] },
];
export function ThemePicker({
  state,
  update,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
}) {
  return (
    <section>
      <h3>Цвет вашего пространства</h3>
      <p>
        Пять спокойных сочетаний. Тема сохраняется вместе с вашими записями.
      </p>
      <div className="theme-grid">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-label={"Тема " + t.name}
            aria-pressed={(state.settings.theme || "sage") === t.id}
            className={
              "theme-option " +
              ((state.settings.theme || "sage") === t.id ? "chosen" : "")
            }
            onClick={() =>
              update((s) => ({
                ...s,
                settings: { ...s.settings, theme: t.id },
              }))
            }
          >
            <span className="theme-swatch" style={{ background: t.colors[0] }}>
              <i style={{ background: t.colors[1] }} />
              <b style={{ background: t.colors[2] }} />
            </span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
export function DesktopSettings({
  flush,
  notify,
}: {
  flush: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const account = useAccount(),
    [prefs, setPrefs] = useState<DesktopPreferences | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!window.doit) return;
    let alive = true;
    const load = () =>
      window
        .doit!.desktopPreferences()
        .then((p) => {
          if (alive) setPrefs(p);
        })
        .catch((e) => {
          if (alive) notify(String(e));
        });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const run = async (
    fn: () => Promise<DesktopPreferences>,
    optimistic?: Partial<DesktopPreferences>,
  ) => {
    const previous = prefs;
    if (optimistic && prefs) setPrefs({ ...prefs, ...optimistic });
    setBusy(true);
    try {
      await flush();
      setPrefs(await fn());
    } catch (e) {
      if (optimistic) setPrefs(previous);
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (
    key: "autoStart" | "closeToTray" | "alwaysOnTop",
    value: boolean,
  ) =>
    run(() => window.doit!.setDesktopPreferences({ [key]: value }), {
      [key]: value,
    });
  if (!window.doit)
    return (
      <section>
        <h3>
          <Monitor size={17} />
          Настольные возможности
        </h3>
        <p>
          Аккаунты, автозапуск, трей и виджеты доступны в установленном
          приложении.
        </p>
      </section>
    );
  return (
    <>
      <section>
        <h3>
          <ShieldCheck size={17} />
          {account.profile ? "Локальный аккаунт" : "Без аккаунта"}
        </h3>
        <p>
          {account.profile ? (
            <>
              Открыт аккаунт <strong>{account.profile.name}</strong>. База и
              вложения зашифрованы. После переустановки приложения они остаются
              в профиле Windows. Для восстановления после переустановки Windows
              сохраните копию вне системного диска.
            </>
          ) : (
            "Ваши записи хранятся на этом компьютере без шифрования. Создайте локальный аккаунт, чтобы защитить их паролем и настроить зашифрованные копии."
          )}
        </p>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => {
            try {
              await flush();
              await window.doit!.logout();
            } catch (e) {
              notify(String(e));
            }
          }}
        >
          <LockKeyhole size={15} />
          {account.profile
            ? "Заблокировать / сменить аккаунт"
            : "Создать аккаунт или войти"}
        </button>
      </section>
      <section>
        <h3>
          <Monitor size={17} />
          Запуск и фон
        </h3>
        {prefs ? (
          <>
            <Toggle
              title="Запускать вместе с Windows"
              description={
                prefs.autoStartSupported
                  ? "DoIT появится в трее. Аккаунт останется заблокирован до ввода пароля."
                  : "Доступно в установленной Windows-версии."
              }
              checked={prefs.autoStart}
              disabled={busy || !prefs.autoStartSupported}
              onChange={(v) => toggle("autoStart", v)}
            />
            <Toggle
              title="При закрытии оставлять в трее"
              description="Крестик скрывает окно. Полный выход — через меню значка рядом с часами."
              checked={prefs.closeToTray}
              disabled={busy}
              onChange={(v) => toggle("closeToTray", v)}
            />
          </>
        ) : (
          <p>Читаем настройки…</p>
        )}
      </section>
      <section>
        <h3>
          <LayoutGrid size={17} />
          Виджеты на рабочем столе
        </h3>
        <p>
          Отдельные небольшие окна: перетаскивайте за верхнюю панель и меняйте
          размер. Если нужна работа при закрытом основном окне, включите трей.
        </p>
        {prefs && (
          <>
            {(["tasks", "goals", "note"] as const).map((kind) => (
              <Toggle
                key={kind}
                title={
                  {
                    tasks: "Задачи на сегодня",
                    goals: "Прогресс целей",
                    note: "Заметка и быстрые мысли",
                  }[kind]
                }
                description={
                  {
                    tasks: "Завершайте и добавляйте дела прямо в виджете.",
                    goals: "Отмечайте маленькие шаги к цели.",
                    note: "Последняя закреплённая заметка и быстрый ввод.",
                  }[kind]
                }
                checked={prefs.widgets[kind]}
                disabled={busy}
                onChange={(value) =>
                  run(
                    () =>
                      window.doit!.setDesktopPreferences({
                        widgets: { ...prefs.widgets, [kind]: value },
                      }),
                    { widgets: { ...prefs.widgets, [kind]: value } },
                  )
                }
              />
            ))}
            <Toggle
              title="Закрепить поверх других окон"
              description="Без закрепления виджеты ведут себя как обычные окна рабочего стола."
              checked={prefs.alwaysOnTop}
              disabled={busy}
              onChange={(v) => toggle("alwaysOnTop", v)}
            />
          </>
        )}
      </section>
      {account.profile && (
        <section>
          <h3>
            <HardDrive size={17} />
            Автоматическая зашифрованная копия
          </h3>
          <p>
            Выберите папку, которую синхронизирует OneDrive или другой облачный
            диск. DoIT записывает туда файл .doit; загрузку в облако выполняет
            приложение вашего диска. Состояние облачной синхронизации DoIT не
            проверяет.
          </p>
          {prefs?.backupFolder && (
            <div className="backup-path">
              <FolderOpen size={16} />
              <span>{prefs.backupFolder}</span>
            </div>
          )}
          <div className="settings-buttons">
            <button
              className="button"
              disabled={busy}
              onClick={() => run(() => window.doit!.chooseBackupFolder())}
            >
              <FolderOpen size={15} />
              {prefs?.backupFolder ? "Изменить папку" : "Выбрать папку"}
            </button>
            <button
              className="button"
              disabled={busy || !prefs?.backupFolder}
              onClick={() => run(() => window.doit!.backupNow())}
            >
              Создать копию сейчас
            </button>
          </div>
          {prefs?.backupLastAt && (
            <p className="backup-status">
              Последняя копия:{" "}
              {new Date(prefs.backupLastAt).toLocaleString("ru-RU")}
            </p>
          )}
          {prefs?.backupError && (
            <p className="inline-error" role="alert">
              {prefs.backupError}
            </p>
          )}
          <p className="settings-note">
            Копия обновляется через 10 секунд после изменений и при полном
            выходе. Сохраняется также предыдущая версия. Для восстановления:
            заблокируйте аккаунт → «Из копии» → введите пароль и выберите файл.
          </p>
        </section>
      )}
    </>
  );
}
function Toggle({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={"toggle-row " + (disabled ? "disabled" : "")}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
