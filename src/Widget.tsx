import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Plus, Target, X } from "lucide-react";
import type { Task, Goal, Note, Theme } from "./model";
type Snapshot = {
  kind: "tasks" | "goals" | "note";
  theme: Theme;
  name: string;
  tasks: Task[];
  goals: Goal[];
  note: Note | null;
};
interface WidgetAPI {
  load(): Promise<Snapshot>;
  toggle(id: string): Promise<Snapshot>;
  progress(id: string): Promise<Snapshot>;
  add(text: string): Promise<Snapshot>;
  open(): Promise<void>;
  hide(): Promise<void>;
  onChanged(callback: (value: Snapshot | null) => void): () => void;
}
declare global {
  interface Window {
    doitWidget?: WidgetAPI;
  }
}
export default function Widget() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!window.doitWidget) return;
    window.doitWidget
      .load()
      .then(setSnapshot)
      .catch((e) => setError(String(e)));
    return window.doitWidget.onChanged(setSnapshot);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = snapshot?.theme || "sage";
  }, [snapshot?.theme]);
  const run = async (fn: () => Promise<Snapshot>) => {
    setBusy(true);
    try {
      setSnapshot(await fn());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  if (!snapshot)
    return (
      <div className="widget-shell">
        <p>{error || "Открываем виджет…"}</p>
      </div>
    );
  return (
    <main className="widget-shell">
      <header className="widget-heading">
        <span className="widget-brand">d·</span>
        <h1>
          {
            { tasks: "Мой день", goals: "Мои цели", note: "Мысль на потом" }[
              snapshot.kind
            ]
          }
        </h1>
        <button
          aria-label="Открыть DoIT"
          onClick={() => window.doitWidget!.open()}
        >
          <ArrowUpRight size={15} />
        </button>
        <button
          aria-label="Скрыть виджет"
          onClick={() => window.doitWidget!.hide()}
        >
          <X size={15} />
        </button>
      </header>
      <section className="widget-body">
        {snapshot.kind === "tasks" && (
          <>
            {snapshot.tasks.map((t) => (
              <div className="widget-task" key={t.id}>
                <button
                  disabled={busy}
                  className="task-check"
                  aria-label={"Завершить: " + t.title}
                  onClick={() => run(() => window.doitWidget!.toggle(t.id))}
                />
                <span>{t.title}</span>
              </div>
            ))}
            {!snapshot.tasks.length && (
              <div className="widget-empty">
                <Check size={26} />
                <h2>Можно выдохнуть.</h2>
                <p>На сегодня всё готово.</p>
              </div>
            )}
          </>
        )}
        {snapshot.kind === "goals" && (
          <>
            {snapshot.goals.map((g) => (
              <article className="widget-goal" key={g.id}>
                <h2>{g.title}</h2>
                <div className="progress-track">
                  <span
                    style={{ width: `${(g.progress / g.target) * 100}%` }}
                  />
                </div>
                <footer>
                  <span>
                    {g.progress} / {g.target} {g.unit}
                  </span>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={"Шаг к цели: " + g.title}
                    onClick={() => run(() => window.doitWidget!.progress(g.id))}
                  >
                    <Plus size={15} />
                  </button>
                </footer>
              </article>
            ))}
            {!snapshot.goals.length && (
              <div className="widget-empty">
                <Target size={26} />
                <h2>Место для новой цели.</h2>
                <p>Создайте её в DoIT.</p>
              </div>
            )}
          </>
        )}
        {snapshot.kind === "note" && (
          <article className="widget-note">
            <span>ЗАПИСАТЬ И НЕ ПОТЕРЯТЬ</span>
            <h2>{snapshot.note?.title || "Хорошим мыслям нужно место."}</h2>
            <p>
              {snapshot.note?.body ||
                "Запишите новую мысль ниже. Она появится в ваших заметках."}
            </p>
          </article>
        )}
      </section>
      {snapshot.kind !== "goals" && (
        <form
          className="widget-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            run(async () => {
              const value = await window.doitWidget!.add(text);
              setText("");
              return value;
            });
          }}
        >
          <input
            aria-label={
              snapshot.kind === "tasks"
                ? "Задача из виджета"
                : "Заметка из виджета"
            }
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              snapshot.kind === "tasks" ? "Добавить дело…" : "Поймать мысль…"
            }
          />
          <button aria-label="Добавить" disabled={busy || !text.trim()}>
            <Plus size={18} />
          </button>
        </form>
      )}
      {error && (
        <p className="inline-error widget-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
