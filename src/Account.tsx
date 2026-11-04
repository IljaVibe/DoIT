import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  HardDrive,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import type { AuthInfo } from "./model";
const browserInfo: AuthInfo = {
  session: "guest",
  profile: null,
  accounts: [],
  hasLegacy: false,
};
const AccountContext = createContext<AuthInfo>(browserInfo);
export const useAccount = () => useContext(AccountContext);
export function AccountShell({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<AuthInfo | null>(
      window.doit ? null : browserInfo,
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (!window.doit) return;
    let active = true;
    window.doit
      .authInfo()
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    const off = window.doit.onAuthChanged((value) => {
      setInfo(value);
      setError("");
    });
    return () => {
      active = false;
      off();
    };
  }, []);
  useEffect(() => {
    if (info?.session === "locked")
      return window.doit?.onBeforeClose(async () => true);
  }, [info?.session]);
  if (!info)
    return (
      <div className="loading">
        <LockKeyhole />
        <p>{error || "Открываем ваше пространство…"}</p>
        {error && (
          <button className="button" onClick={() => location.reload()}>
            Повторить
          </button>
        )}
      </div>
    );
  if (info.session === "locked")
    return <AccountGate info={info} onSession={setInfo} />;
  return (
    <AccountContext.Provider value={info}>
      <div key={info.profile?.id || "guest"}>{children}</div>
    </AccountContext.Provider>
  );
}
function AccountGate({
  info,
  onSession,
}: {
  info: AuthInfo;
  onSession: (info: AuthInfo) => void;
}) {
  const [mode, setMode] = useState<"login" | "create" | "restore">(
      info.accounts.length ? "login" : "create",
    ),
    [name, setName] = useState(""),
    [id, setId] = useState(info.accounts[0]?.id || ""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [migrate, setMigrate] = useState(info.hasLegacy),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (action: () => Promise<AuthInfo | null>) => {
    setBusy(true);
    setError("");
    try {
      const value = await action();
      if (value) {
        setPassword("");
        setConfirmation("");
        onSession(value);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="account-page">
      <div className="account-card">
        <span className="brand-symbol">
          d<span>·</span>
        </span>
        <span className="eyebrow">ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО</span>
        <h1>
          {mode === "login"
            ? "С возвращением."
            : mode === "create"
              ? "Всё важное — под защитой."
              : "Ваше пространство с вами."}
        </h1>
        <p>
          {mode === "restore"
            ? "Восстановите аккаунт, записи и документы из зашифрованного файла .doit."
            : "Локальный аккаунт с паролем. Без подписки и регистрации на сервере."}
        </p>
        <div className="segmented account-tabs">
          {info.accounts.length > 0 && (
            <button
              disabled={busy}
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Войти
            </button>
          )}
          <button
            disabled={busy}
            className={mode === "create" ? "active" : ""}
            onClick={() => {
              setMode("create");
              setError("");
            }}
          >
            Создать аккаунт
          </button>
          <button
            disabled={busy}
            className={mode === "restore" ? "active" : ""}
            onClick={() => {
              setMode("restore");
              setError("");
            }}
          >
            Из копии
          </button>
        </div>
        <form
          className="standard-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "create" && password !== confirmation) {
              setError("Пароли не совпадают");
              return;
            }
            run(() =>
              mode === "create"
                ? window.doit!.createAccount(name, password, migrate)
                : mode === "login"
                  ? window.doit!.login(id, password)
                  : window.doit!.restoreAccount(password),
            );
          }}
        >
          {mode === "create" && (
            <label>
              Имя аккаунта
              <input
                required
                autoComplete="username"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Александр"
              />
            </label>
          )}
          {mode === "login" && (
            <label>
              Ваш аккаунт
              <select
                aria-label="Ваш аккаунт"
                value={id}
                onChange={(e) => setId(e.target.value)}
              >
                {info.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {mode === "restore" ? "Пароль от резервной копии" : "Пароль"}
            <input
              type="password"
              autoComplete={
                mode === "create" ? "new-password" : "current-password"
              }
              minLength={8}
              maxLength={256}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Не менее 8 символов"
            />
          </label>
          {mode === "create" && (
            <>
              <label>
                Повторите пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={256}
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              {info.hasLegacy && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={migrate}
                    onChange={(e) => setMigrate(e.target.checked)}
                  />
                  Скопировать текущие записи из версии без аккаунта
                </label>
              )}
            </>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary"
            disabled={busy || !password || (mode === "create" && !name.trim())}
          >
            {busy
              ? "Подождите…"
              : mode === "login"
                ? "Открыть пространство"
                : mode === "create"
                  ? "Создать локальный аккаунт"
                  : "Выбрать копию и восстановить"}
            {mode === "restore" ? (
              <Upload size={16} />
            ) : (
              <ArrowRight size={16} />
            )}
          </button>
        </form>
        <div className="account-hint">
          <ShieldCheck size={20} />
          <p>
            Сохраните пароль: без него восстановить зашифрованную копию нельзя.
            Для защиты от потери компьютера выберите в настройках папку копий в
            OneDrive или другом облачном диске.
          </p>
        </div>
        <button
          className="text-button guest-button"
          disabled={busy}
          onClick={() => run(() => window.doit!.guest())}
        >
          <UserRound size={15} />
          Продолжить без аккаунта
        </button>
      </div>
      <span className="account-footer">
        <HardDrive size={13} />
        DoIT 0.2 · данные на вашем устройстве
      </span>
    </main>
  );
}
