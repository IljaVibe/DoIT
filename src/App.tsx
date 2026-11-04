import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CloudSun,
  File,
  FileText,
  Folder,
  HardDrive,
  Inbox,
  LayoutGrid,
  Lightbulb,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Table2,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  dayKey,
  offsetDay,
  formatDate,
  uid,
  newTask,
  exampleState,
  type State,
  type Task,
  type Note,
  type Goal,
  type City,
  type Weather,
  type View,
} from "./model";
import { useStore } from "./useStore";
import { ThemePicker, DesktopSettings } from "./Preferences";
import { useAccount } from "./Account";

const nav = [
  { id: "today", label: "Мой день", icon: Sun },
  { id: "inbox", label: "Входящие", icon: Inbox },
  { id: "calendar", label: "Календарь", icon: CalendarDays },
  { id: "goals", label: "Цели", icon: Target },
  { id: "notes", label: "Заметки и идеи", icon: FileText },
  { id: "files", label: "Файлы", icon: Paperclip },
  { id: "database", label: "База задач", icon: Table2 },
] as const;
type ModalState =
  | { type: "task"; task: Task }
  | { type: "note"; note: Note }
  | { type: "goal"; goal: Goal }
  | { type: "settings" }
  | { type: "project" }
  | null;
const IconButton = ({
  label,
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className={"icon-button " + className}
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const target = ref.current;
    const first =
      target?.querySelector<HTMLElement>("input,textarea,select") ||
      target?.querySelector<HTMLElement>("button");
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          target?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,textarea,select,[tabindex="0"]',
          ) || [],
        ).filter((x) => x.offsetParent !== null);
        const start = items[0],
          end = items.at(-1);
        if (e.shiftKey && document.activeElement === start) {
          e.preventDefault();
          end?.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          start?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-heading">
          <h2 id="dialog-title">{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={19} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({
  icon: Icon = Sparkles,
  title,
  text,
  action,
}: {
  icon?: typeof Sun;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={29} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function TaskRow({
  task,
  project,
  onToggle,
  onOpen,
}: {
  task: Task;
  project?: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className={"task-row " + (task.completed ? "completed" : "")}>
      <button
        className={"task-check " + task.priority}
        aria-label={
          (task.completed ? "Вернуть задачу: " : "Завершить задачу: ") +
          task.title
        }
        onClick={onToggle}
      >
        {task.completed && <Check size={13} />}
      </button>
      <button className="task-content" onClick={onOpen}>
        <span className="task-title">{task.title}</span>
        {(task.description || task.subtasks.length > 0) && (
          <span className="task-description">
            {task.subtasks.length > 0 ? (
              <>
                <CheckCheck size={12} />
                {task.subtasks.filter((s) => s.completed).length}/
                {task.subtasks.length}
                <span className="separator">·</span>
              </>
            ) : null}
            {task.description.split("\n")[0]}
          </span>
        )}
      </button>
      <div className="task-tags">
        {task.priority === "high" && !task.completed && (
          <span className="priority-dot" title="Высокий приоритет" />
        )}
        {project && (
          <span className="project-tag">
            <span />
            {project}
          </span>
        )}
        {task.date && (
          <span
            className={
              "task-date " +
              (!task.completed && task.date < dayKey() ? "overdue" : "")
            }
          >
            {task.date === dayKey() ? "Сегодня" : formatDate(task.date)}
          </span>
        )}
      </div>
      <IconButton
        className="row-more"
        label={"Открыть задачу: " + task.title}
        onClick={onOpen}
      >
        <MoreHorizontal size={18} />
      </IconButton>
    </div>
  );
}

export default function App() {
  const { state, update, replace, loaded, status, error, flush, retry } =
    useStore();
  const [view, setView] = useState<View>("today"),
    [projectId, setProjectId] = useState(""),
    [modal, setModal] = useState<ModalState>(null);
  const [today, setToday] = useState(dayKey()),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [toast, setToast] = useState("");
  const [quick, setQuick] = useState(""),
    [quickDate, setQuickDate] = useState(dayKey()),
    [showDone, setShowDone] = useState(false),
    [noteKind, setNoteKind] = useState("all");
  const [filter, setFilter] = useState("active"),
    [dbProject, setDbProject] = useState(""),
    [dbSort, setDbSort] = useState("date");
  const [selectedDay, setSelectedDay] = useState(dayKey()),
    [month, setMonth] = useState(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
  const [fileBusy, setFileBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const taskModal = (task?: Task, date?: string) =>
    setModal({
      type: "task",
      task:
        task ||
        newTask(
          date ??
            (view === "inbox" ? "" : view === "calendar" ? selectedDay : today),
          view === "project" ? projectId : "",
        ),
    });
  useEffect(() => {
    const timer = setInterval(() => setToday(dayKey()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n" && !modal) {
        e.preventDefault();
        taskModal();
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });
  const notify = (e: unknown) =>
    setToast(e instanceof Error ? e.message : String(e));
  const navigate = (next: View, p = "") => {
    setView(next);
    setProjectId(p);
    setQuery("");
    setSearchOpen(false);
    setShowDone(false);
  };
  const toggleTask = (id: string) =>
    update((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t,
      ),
    }));
  const saveTask = (task: Task) => {
    update((s) => ({
      ...s,
      tasks: s.tasks.some((t) => t.id === task.id)
        ? s.tasks.map((t) =>
            t.id === task.id ? { ...task, completed: t.completed } : t,
          )
        : [task, ...s.tasks],
    }));
    setModal(null);
    setToast("Задача сохранена");
  };
  const removeTask = (id: string) => {
    if (
      !confirm(
        "Удалить эту задачу? Прикреплённые документы останутся в разделе «Файлы».",
      )
    )
      return;
    update((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
      attachments: s.attachments.map((a) =>
        a.taskId === id ? { ...a, taskId: "" } : a,
      ),
    }));
    setModal(null);
  };
  const saveNote = (note: Note) => {
    update((s) => ({
      ...s,
      notes: s.notes.some((n) => n.id === note.id)
        ? s.notes.map((n) => (n.id === note.id ? note : n))
        : [note, ...s.notes],
    }));
    setModal(null);
    setToast("Заметка сохранена");
  };
  const createNote = (kind: "note" | "idea" = "note") =>
    setModal({
      type: "note",
      note: {
        id: uid(),
        title: "",
        body: "",
        kind,
        pinned: false,
        updatedAt: new Date().toISOString(),
      },
    });
  const saveGoal = (goal: Goal) => {
    update((s) => ({
      ...s,
      goals: s.goals.some((g) => g.id === goal.id)
        ? s.goals.map((g) => (g.id === goal.id ? goal : g))
        : [goal, ...s.goals],
    }));
    setModal(null);
  };
  const attachFiles = async (taskId = "") => {
    if (!window.doit) {
      setToast("Прикрепление документов доступно в Windows-приложении.");
      return;
    }
    setFileBusy(true);
    try {
      await flush();
      const added = await window.doit.attach();
      if (added.length) {
        update((s) => ({
          ...s,
          attachments: [
            ...s.attachments,
            ...added.map((a) => ({ ...a, taskId })),
          ],
        }));
        setToast(`Добавлено файлов: ${added.length}`);
      }
    } catch (e) {
      notify(e);
    } finally {
      setFileBusy(false);
    }
  };
  const projectName = (id: string) =>
    state.projects.find((p) => p.id === id)?.name;
  const todayTasks = state.tasks.filter((t) => t.date === today),
    doneToday = todayTasks.filter((t) => t.completed).length;
  const overdue = state.tasks.filter(
    (t) => t.date && t.date < today && !t.completed,
  );
  const newGoal = () =>
    setModal({
      type: "goal",
      goal: {
        id: uid(),
        title: "",
        description: "",
        progress: 0,
        target: 10,
        unit: "шагов",
        deadline: "",
      },
    });
  const newButton = (label: string, fn: () => void) => (
    <button className="button primary" onClick={fn}>
      <Plus size={17} />
      {label}
    </button>
  );
  const currentNav = nav.find((n) => n.id === view);
  const currentTitle =
    view === "project"
      ? projectName(projectId) || "Проект"
      : currentNav?.label || "Мой день";
  const renderTask = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      project={projectName(task.projectId)}
      onToggle={() => toggleTask(task.id)}
      onOpen={() => taskModal(task)}
    />
  );
  const quickAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    const task = {
      ...newTask(
        view === "inbox" ? "" : quickDate,
        view === "project" ? projectId : "",
      ),
      title: quick.trim(),
    };
    update((s) => ({ ...s, tasks: [task, ...s.tasks] }));
    setQuick("");
    setToast("Задача добавлена");
  };
  const quickForm = (
    <form className="quick-add" onSubmit={quickAdd}>
      <Plus size={19} />
      <input
        aria-label="Быстрая задача"
        placeholder="Что нужно сделать?"
        value={quick}
        maxLength={500}
        onChange={(e) => setQuick(e.target.value)}
      />
      {view !== "inbox" && (
        <input
          className="quick-date"
          type="date"
          aria-label="Дата быстрой задачи"
          value={quickDate}
          onChange={(e) => setQuickDate(e.target.value)}
        />
      )}
      <button
        type="submit"
        className="quick-submit"
        aria-label="Добавить быструю задачу"
        disabled={!quick.trim()}
      >
        <ArrowRight size={17} />
      </button>
    </form>
  );
  const tasksForList = state.tasks.filter((t) =>
    view === "inbox"
      ? !t.date
      : view === "project"
        ? t.projectId === projectId
        : t.date === today,
  );
  const active = tasksForList
    .filter((t) => !t.completed)
    .sort(
      (a, b) =>
        (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0),
    );
  const completed = tasksForList.filter((t) => t.completed);
  const search = query.trim().toLocaleLowerCase("ru");
  const foundTasks = search
    ? state.tasks.filter((t) =>
        (t.title + " " + t.description)
          .toLocaleLowerCase("ru")
          .includes(search),
      )
    : [];
  const foundNotes = search
    ? state.notes.filter((n) =>
        (n.title + " " + n.body).toLocaleLowerCase("ru").includes(search),
      )
    : [];
  const foundGoals = search
    ? state.goals.filter((g) =>
        (g.title + " " + g.description)
          .toLocaleLowerCase("ru")
          .includes(search),
      )
    : [];
  const foundFiles = search
    ? state.attachments.filter((a) =>
        a.name.toLocaleLowerCase("ru").includes(search),
      )
    : [];
  if (!loaded)
    return (
      <div className="loading">
        <span className="brand-symbol">
          d<span>·</span>
        </span>
        {error ? (
          <>
            <p>Не удалось открыть данные. {error}</p>
            <button className="button" onClick={() => location.reload()}>
              Повторить
            </button>
          </>
        ) : (
          <>
            <Loader2 className="spin" />
            <p>Открываем ваше пространство…</p>
          </>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <span className="brand-symbol">
            d<span>·</span>
          </span>
          <span>
            DoIT<span className="brand-caption">пространство для важного</span>
          </span>
        </a>
        <div className="workspace">
          <span className="avatar">
            {state.settings.name.slice(0, 1).toUpperCase() || "Я"}
          </span>
          <div>
            <strong>{state.settings.name || "Моё пространство"}</strong>
            <small>Личное пространство</small>
          </div>
          <span className="workspace-dot" title="Локальное хранилище" />
        </div>
        <div className="nav-label">ОБЗОР</div>
        <nav aria-label="Основная навигация">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={"nav-item " + (view === id ? "selected" : "")}
              onClick={() => navigate(id)}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {id === "today" &&
                todayTasks.filter((t) => !t.completed).length > 0 && (
                  <small>{todayTasks.filter((t) => !t.completed).length}</small>
                )}
              {id === "inbox" &&
                state.tasks.filter((t) => !t.date && !t.completed).length >
                  0 && (
                  <small>
                    {state.tasks.filter((t) => !t.date && !t.completed).length}
                  </small>
                )}
            </button>
          ))}
        </nav>
        <div className="nav-label project-heading">
          МОИ ПРОЕКТЫ
          <IconButton
            label="Создать проект"
            onClick={() => setModal({ type: "project" })}
          >
            <Plus size={15} />
          </IconButton>
        </div>
        <div className="projects">
          {state.projects.map((p, i) => (
            <button
              key={p.id}
              className={
                "nav-item " +
                (view === "project" && projectId === p.id ? "selected" : "")
              }
              onClick={() => navigate("project", p.id)}
            >
              <span className={"project-dot tone-" + (i % 3)} />
              <span>{p.name}</span>
            </button>
          ))}
          {!state.projects.length && (
            <button
              className="add-project"
              onClick={() => setModal({ type: "project" })}
            >
              <Plus size={14} />
              Создать первый проект
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-card-icon">
              <HardDrive size={17} />
            </span>
            <strong>Только ваше.</strong>
            <p>
              Задачи и мысли хранятся
              <br />
              на этом устройстве.
            </p>
            <span className="local-label">
              <span />
              Без регистрации
            </span>
          </div>
          <button
            className="nav-item settings-link"
            onClick={() => setModal({ type: "settings" })}
          >
            <Settings size={18} strokeWidth={1.7} />
            <span>Настройки</span>
            <small>v0.2</small>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Моё пространство</span>
            <ChevronRight size={13} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Поиск по всему пространству"
                placeholder="Найти что-нибудь…"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
              />
              <kbd>Ctrl K</kbd>
            </div>
            <span
              className={"save-indicator " + status}
              title={
                status === "saved"
                  ? "Все изменения сохранены на устройстве"
                  : status === "saving"
                    ? "Сохраняем изменения…"
                    : error
              }
            >
              {status === "saving" ? (
                <Loader2 size={14} className="spin" />
              ) : status === "saved" ? (
                <CheckCheck size={16} />
              ) : (
                <button onClick={retry}>Повторить сохранение</button>
              )}
            </span>
          </div>
          {searchOpen && query && (
            <>
              <button
                className="search-backdrop"
                aria-label="Закрыть поиск"
                onClick={() => setSearchOpen(false)}
              />
              <div className="search-results">
                <div className="search-results-heading">
                  РЕЗУЛЬТАТЫ ПОИСКА{" "}
                  <button
                    className="icon-button"
                    aria-label="Очистить поиск"
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(false);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                {foundTasks.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      taskModal(t);
                      setSearchOpen(false);
                    }}
                  >
                    <Circle size={16} />
                    <span>
                      {t.title}
                      <small>Задача · {formatDate(t.date)}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
                {foundNotes.slice(0, 4).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setModal({ type: "note", note: n });
                      setSearchOpen(false);
                    }}
                  >
                    <FileText size={16} />
                    <span>
                      {n.title || "Без названия"}
                      <small>{n.kind === "idea" ? "Идея" : "Заметка"}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
                {foundGoals.slice(0, 3).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setModal({ type: "goal", goal: g });
                      setSearchOpen(false);
                    }}
                  >
                    <Target size={16} />
                    <span>
                      {g.title}
                      <small>
                        Цель · {g.progress} / {g.target}
                      </small>
                    </span>
                  </button>
                ))}
                {foundFiles.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      navigate("files");
                    }}
                  >
                    <File size={16} />
                    <span>
                      {a.name}
                      <small>Документ</small>
                    </span>
                  </button>
                ))}
                {!foundTasks.length &&
                  !foundNotes.length &&
                  !foundGoals.length &&
                  !foundFiles.length && (
                    <p className="search-nothing">
                      Ничего не найдено. Попробуйте другое слово.
                    </p>
                  )}
              </div>
            </>
          )}
        </header>
        {status === "error" && (
          <div className="error-banner" role="alert">
            Изменения ещё не сохранены. Не закрывайте приложение.{" "}
            <button onClick={retry}>Повторить</button>
          </div>
        )}
        <main className={"page " + (view === "today" ? "today-page" : "")}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "today"
                  ? new Date(today + "T12:00:00").toLocaleDateString("ru-RU", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : view === "calendar"
                    ? "МЕСТО ДЛЯ ПЛАНОВ"
                    : view === "goals"
                      ? "МАЛЕНЬКИЕ ШАГИ, БОЛЬШИЕ ПЕРЕМЕНЫ"
                      : view === "notes"
                        ? "ДАЙТЕ МЫСЛЯМ МЕСТО"
                        : view === "files"
                          ? "ВСЁ НУЖНОЕ ПОД РУКОЙ"
                          : view === "database"
                            ? "ПОРЯДОК В ДЕТАЛЯХ"
                            : "ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО"}
              </div>
              <h1>
                {view === "today"
                  ? `Хорошего дня${state.settings.name ? ", " + state.settings.name : ""}`
                  : currentTitle}
                {view === "today" && (
                  <span className="greeting-sun">
                    <Sun size={28} strokeWidth={1.3} />
                  </span>
                )}
              </h1>
              <p>
                {view === "today"
                  ? "Не нужно успевать всё. Начните с того, что важно."
                  : view === "inbox"
                    ? "Соберите мысли и дела здесь. Распределить по датам можно позже."
                    : view === "calendar"
                      ? "Посмотрите на свой месяц. Оставьте место для себя."
                      : view === "goals"
                        ? "Большие изменения начинаются с одного небольшого шага."
                        : view === "notes"
                          ? "Заметки, внезапные идеи и всё, что не хочется забыть."
                          : view === "files"
                            ? "Документы и вложения, которые всегда рядом с вашими планами."
                            : view === "database"
                              ? "Все задачи в одной таблице. Фильтруйте и находите нужное."
                              : "Сосредоточьтесь на делах, которые относятся к этому проекту."}
              </p>
            </div>
            <div className="heading-action">
              {view === "goals" ? (
                newButton("Новая цель", newGoal)
              ) : view === "notes" ? (
                newButton("Новая заметка", () => createNote())
              ) : view === "files" ? (
                <button
                  className="button primary"
                  disabled={fileBusy}
                  onClick={() => attachFiles()}
                >
                  <Upload size={17} />
                  {fileBusy ? "Добавляем…" : "Прикрепить файл"}
                </button>
              ) : (
                newButton("Добавить задачу", () => taskModal())
              )}
            </div>
          </div>
          {view === "today" && (
            <div className="today-layout">
              <section className="today-main">
                <div className="day-card">
                  <div className="day-card-copy">
                    <span className="pill">
                      <span />В СВОЁМ ТЕМПЕ
                    </span>
                    <h2>
                      У каждого дня
                      <br />
                      есть своё главное.
                    </h2>
                    <p>
                      {todayTasks.length ? (
                        <>
                          Сегодня у вас {todayTasks.length}{" "}
                          {todayTasks.length === 1 ? "задача" : "задач"}.<br />
                          {doneToday
                            ? "Вы уже сделали первый шаг."
                            : "Начните с одного небольшого дела."}
                        </>
                      ) : (
                        <>
                          Чистый лист для нового дня.
                          <br />
                          Каким вы хотите его запомнить?
                        </>
                      )}
                    </p>
                    <div className="day-progress">
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${todayTasks.length ? (doneToday / todayTasks.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span>
                        {doneToday} из {todayTasks.length} выполнено
                      </span>
                    </div>
                  </div>
                  <div className="plant-art" aria-hidden="true">
                    <div className="art-circle" />
                    <div className="plant-stem" />
                    <i className="leaf l1" />
                    <i className="leaf l2" />
                    <i className="leaf l3" />
                    <i className="leaf l4" />
                    <div className="plant-pot" />
                    <span className="art-spark s1">✧</span>
                    <span className="art-spark s2">✧</span>
                    <div className="art-ground" />
                  </div>
                </div>
                <div className="section-heading">
                  <h2>
                    План на сегодня{" "}
                    <span className="count">{active.length}</span>
                  </h2>
                  <span className="muted small">Шаг за шагом</span>
                </div>
                {quickForm}
                {overdue.length > 0 && (
                  <details className="overdue-block">
                    <summary>
                      Ожидают внимания <span>{overdue.length}</span>
                    </summary>
                    <p>
                      Эти задачи остались с прошлых дней. Откройте задачу, чтобы
                      выбрать новую дату.
                    </p>
                    {overdue.map(renderTask)}
                  </details>
                )}
                <div className="task-list">
                  {active.map(renderTask)}
                  {!active.length && (
                    <Empty
                      icon={CheckCheck}
                      title={
                        todayTasks.length
                          ? "На сегодня всё готово"
                          : "Освободите место для главного"
                      }
                      text={
                        todayTasks.length
                          ? "Можно выдохнуть. Завершённые задачи доступны ниже."
                          : "Добавьте первую задачу — маленького шага достаточно."
                      }
                    />
                  )}
                </div>
                {completed.length > 0 && (
                  <>
                    <button
                      className="completed-toggle"
                      onClick={() => setShowDone(!showDone)}
                    >
                      <ChevronDown
                        size={14}
                        className={showDone ? "rotated" : ""}
                      />
                      Выполнено <span>{completed.length}</span>
                    </button>
                    {showDone && completed.map(renderTask)}
                  </>
                )}
                <div className="gentle-footer">
                  <span />
                  Меньше спешки. Больше смысла.
                  <span />
                </div>
              </section>
              <aside className="right-rail">
                <WeatherCard
                  city={state.settings.city}
                  onSettings={() => setModal({ type: "settings" })}
                />
                <section className="rail-card focus-card">
                  <div className="rail-heading">
                    <h3>
                      <Target size={16} />
                      Ближе к цели
                    </h3>
                    <button
                      className="text-button"
                      onClick={() => navigate("goals")}
                      aria-label="Все цели"
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  {state.goals
                    .filter((g) => g.progress < g.target)
                    .slice(0, 1)
                    .map((g) => (
                      <div key={g.id}>
                        <span className="mini-label">
                          НЕБОЛЬШОЙ ШАГ СЕГОДНЯ
                        </span>
                        <button
                          className="goal-link"
                          onClick={() => setModal({ type: "goal", goal: g })}
                        >
                          {g.title}
                        </button>
                        <div className="progress-track">
                          <span
                            style={{
                              width: `${(g.progress / g.target) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="progress-caption">
                          <span>
                            {g.progress} из {g.target} {g.unit}
                          </span>
                          <strong>
                            {Math.round((g.progress / g.target) * 100)}%
                          </strong>
                        </div>
                      </div>
                    ))}
                  {!state.goals.some((g) => g.progress < g.target) && (
                    <>
                      <p className="rail-description">
                        Что вы давно хотели попробовать?
                      </p>
                      <button className="text-button" onClick={newGoal}>
                        Добавить цель <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </section>
                <section className="rail-card thought-card">
                  <div className="rail-heading">
                    <h3>
                      <Lightbulb size={16} />
                      Мысль на потом
                    </h3>
                    <IconButton
                      label="Записать идею"
                      onClick={() => createNote("idea")}
                    >
                      <Plus size={17} />
                    </IconButton>
                  </div>
                  {state.notes.length ? (
                    <button
                      className="thought-preview"
                      onClick={() =>
                        setModal({
                          type: "note",
                          note:
                            state.notes.find((n) => n.pinned) || state.notes[0],
                        })
                      }
                    >
                      <span className="note-quote">“</span>
                      <strong>
                        {(state.notes.find((n) => n.pinned) || state.notes[0])
                          .title || "Без названия"}
                      </strong>
                      <p>
                        {
                          (state.notes.find((n) => n.pinned) || state.notes[0])
                            .body
                        }
                      </p>
                      <span>
                        Открыть заметку <ArrowUpRight size={13} />
                      </span>
                    </button>
                  ) : (
                    <>
                      <p className="rail-description">
                        Иногда лучшие идеи приходят между делом.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => createNote("idea")}
                      >
                        Поймать мысль <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </section>
                <div className="keyboard-tip">
                  <kbd>Ctrl</kbd> + <kbd>N</kbd>
                  <span>новая задача</span>
                </div>
              </aside>
            </div>
          )}
          {(view === "inbox" || view === "project") && (
            <section className="list-panel">
              {view === "project" && (
                <div className="project-tools">
                  <span>{tasksForList.length} задач в проекте</span>
                  <button
                    className="text-button danger"
                    onClick={() => {
                      if (
                        confirm(
                          "Удалить проект? Его задачи останутся без проекта.",
                        )
                      ) {
                        update((s) => ({
                          ...s,
                          projects: s.projects.filter(
                            (p) => p.id !== projectId,
                          ),
                          tasks: s.tasks.map((t) =>
                            t.projectId === projectId
                              ? { ...t, projectId: "" }
                              : t,
                          ),
                        }));
                        navigate("inbox");
                      }
                    }}
                  >
                    Удалить проект
                  </button>
                </div>
              )}
              {quickForm}
              {active.map(renderTask)}
              {!active.length && (
                <Empty
                  icon={Inbox}
                  title="Здесь пока тихо"
                  text="Добавьте задачу, идею для дела или то, что не хочется забыть."
                />
              )}
              {completed.length > 0 && (
                <>
                  <button
                    className="completed-toggle"
                    onClick={() => setShowDone(!showDone)}
                  >
                    <ChevronDown size={14} />
                    Выполнено ({completed.length})
                  </button>
                  {showDone && completed.map(renderTask)}
                </>
              )}
            </section>
          )}
          {view === "calendar" && (
            <div className="calendar-layout">
              <section className="calendar-panel">
                <div className="calendar-toolbar">
                  <h2>
                    {month.toLocaleDateString("ru-RU", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <div>
                    <button
                      className="button compact"
                      onClick={() => {
                        setMonth(
                          new Date(
                            new Date().getFullYear(),
                            new Date().getMonth(),
                            1,
                          ),
                        );
                        setSelectedDay(today);
                      }}
                    >
                      Сегодня
                    </button>
                    <IconButton
                      label="Предыдущий месяц"
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronLeft size={18} />
                    </IconButton>
                    <IconButton
                      label="Следующий месяц"
                      onClick={() =>
                        setMonth(
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronRight size={18} />
                    </IconButton>
                  </div>
                </div>
                <div className="calendar-weekdays">
                  {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {Array.from({ length: 42 }, (_, i) => {
                    const date = new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        1 - ((month.getDay() + 6) % 7) + i,
                      ),
                      key = dayKey(date),
                      items = state.tasks.filter((t) => t.date === key);
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        aria-label={formatDate(key, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDay(key);
                          }
                        }}
                        className={
                          "calendar-cell " +
                          (date.getMonth() !== month.getMonth()
                            ? "outside "
                            : "") +
                          (key === today ? "is-today " : "") +
                          (key === selectedDay ? "is-selected" : "")
                        }
                        onClick={() => setSelectedDay(key)}
                      >
                        <span className="day-number">{date.getDate()}</span>
                        {items.slice(0, 2).map((t) => (
                          <button
                            className={
                              "calendar-task " + (t.completed ? "done" : "")
                            }
                            key={t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              taskModal(t);
                            }}
                          >
                            <span />
                            {t.title}
                          </button>
                        ))}
                        {items.length > 2 && (
                          <span className="more-events">
                            ещё {items.length - 2}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="calendar-agenda">
                <div className="section-heading">
                  <h2>
                    {formatDate(selectedDay, { day: "numeric", month: "long" })}
                  </h2>
                  <IconButton
                    label="Добавить задачу на выбранный день"
                    onClick={() => taskModal(undefined, selectedDay)}
                  >
                    <Plus size={18} />
                  </IconButton>
                </div>
                {state.tasks
                  .filter((t) => t.date === selectedDay)
                  .map(renderTask)}
                {!state.tasks.some((t) => t.date === selectedDay) && (
                  <Empty
                    icon={CalendarDays}
                    title="День без планов"
                    text="Добавьте дело или оставьте время свободным."
                    action={
                      <button
                        className="button"
                        onClick={() => taskModal(undefined, selectedDay)}
                      >
                        Запланировать
                      </button>
                    }
                  />
                )}
              </section>
            </div>
          )}
          {view === "goals" && (
            <>
              {!state.goals.length ? (
                <Empty
                  icon={Target}
                  title="К чему хочется прийти?"
                  text="Выберите измеримую цель: книги, тренировки, уроки или накопления."
                  action={newButton("Поставить цель", newGoal)}
                />
              ) : (
                <div className="goal-grid">
                  {state.goals.map((g) => (
                    <article
                      className={
                        "goal-card " +
                        (g.progress === g.target ? "achieved" : "")
                      }
                      key={g.id}
                    >
                      <div className="goal-top">
                        <span className="goal-icon">
                          {g.progress === g.target ? (
                            <Check size={23} />
                          ) : (
                            <Target size={23} strokeWidth={1.5} />
                          )}
                        </span>
                        <IconButton
                          label={"Изменить цель: " + g.title}
                          onClick={() => setModal({ type: "goal", goal: g })}
                        >
                          <MoreHorizontal size={19} />
                        </IconButton>
                      </div>
                      <span className="mini-label">
                        {g.progress === g.target
                          ? "ЦЕЛЬ ДОСТИГНУТА"
                          : g.deadline
                            ? "ДО " +
                              formatDate(g.deadline, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }).toUpperCase()
                            : "В СВОЁМ ТЕМПЕ"}
                      </span>
                      <button
                        className="goal-link"
                        onClick={() => setModal({ type: "goal", goal: g })}
                      >
                        {g.title}
                      </button>
                      <p>
                        {g.description ||
                          "Каждый небольшой шаг имеет значение."}
                      </p>
                      <div className="goal-numbers">
                        <strong>
                          {g.progress}
                          <span> / {g.target}</span>
                        </strong>
                        <span>{g.unit}</span>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{ width: `${(g.progress / g.target) * 100}%` }}
                        />
                      </div>
                      <div className="goal-bottom">
                        <span>
                          {Math.round((g.progress / g.target) * 100)}% пути
                          пройдено
                        </span>
                        <button
                          className="button compact"
                          disabled={g.progress >= g.target}
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              goals: s.goals.map((x) =>
                                x.id === g.id
                                  ? {
                                      ...x,
                                      progress: Math.min(
                                        x.target,
                                        x.progress + 1,
                                      ),
                                    }
                                  : x,
                              ),
                            }))
                          }
                        >
                          <Plus size={14} />1 {g.unit}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {view === "notes" && (
            <>
              <div className="view-toolbar">
                <div className="segmented">
                  {[
                    ["all", "Все записи"],
                    ["note", "Заметки"],
                    ["idea", "Идеи"],
                  ].map(([id, label]) => (
                    <button
                      className={noteKind === id ? "active" : ""}
                      key={id}
                      onClick={() => setNoteKind(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="muted small">
                  {state.notes.length} записей
                </span>
              </div>
              <div className="notes-grid">
                {state.notes
                  .filter((n) => noteKind === "all" || n.kind === noteKind)
                  .sort(
                    (a, b) =>
                      Number(b.pinned) - Number(a.pinned) ||
                      b.updatedAt.localeCompare(a.updatedAt),
                  )
                  .map((n) => (
                    <article className={"note-card " + n.kind} key={n.id}>
                      <div className="note-top">
                        <span>
                          {n.kind === "idea" ? (
                            <Lightbulb size={15} />
                          ) : (
                            <FileText size={15} />
                          )}{" "}
                          {n.kind === "idea" ? "Идея" : "Заметка"}
                        </span>
                        <IconButton
                          label={
                            n.pinned ? "Открепить заметку" : "Закрепить заметку"
                          }
                          className={n.pinned ? "pinned" : ""}
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              notes: s.notes.map((x) =>
                                x.id === n.id ? { ...x, pinned: !x.pinned } : x,
                              ),
                            }))
                          }
                        >
                          <Pin size={15} />
                        </IconButton>
                      </div>
                      <button
                        className="note-body"
                        onClick={() => setModal({ type: "note", note: n })}
                      >
                        <h2>{n.title || "Без названия"}</h2>
                        <p>{n.body || "Пустая страница для новых мыслей…"}</p>
                      </button>
                      <div className="note-bottom">
                        <span>
                          {new Date(n.updatedAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                        <ArrowUpRight size={15} />
                      </div>
                    </article>
                  ))}
                <button
                  className="new-note-card"
                  onClick={() =>
                    createNote(noteKind === "idea" ? "idea" : "note")
                  }
                >
                  <span>
                    <Plus size={23} strokeWidth={1.4} />
                  </span>
                  Записать мысль
                </button>
              </div>
            </>
          )}
          {view === "files" && (
            <>
              <div className="files-info">
                <Folder size={20} />
                <div>
                  <strong>Документы остаются с вами</strong>
                  <p>
                    DoIT сохраняет собственную копию. Перемещение исходного
                    файла её не затронет.
                  </p>
                </div>
                <span>
                  {(
                    state.attachments.reduce((s, a) => s + a.size, 0) /
                    1024 /
                    1024
                  ).toFixed(1)}{" "}
                  МБ
                </span>
              </div>
              {!state.attachments.length ? (
                <Empty
                  icon={Paperclip}
                  title="Всё нужное в одном месте"
                  text="Прикрепите PDF, таблицы, изображения или другие документы. До 100 МБ на файл."
                  action={
                    <button
                      className="button"
                      disabled={fileBusy}
                      onClick={() => attachFiles()}
                    >
                      <Plus size={16} />
                      Выбрать файлы
                    </button>
                  }
                />
              ) : (
                <div className="file-list">
                  {state.attachments.map((a) => (
                    <div className="file-row" key={a.id}>
                      <span className="file-icon">
                        <FileText size={23} strokeWidth={1.4} />
                      </span>
                      <button
                        className="file-name"
                        onClick={() =>
                          window.doit?.openFile(a.id).catch(notify)
                        }
                      >
                        <strong>{a.name}</strong>
                        <small>
                          {a.size < 1024 * 1024
                            ? `${Math.max(1, Math.round(a.size / 1024))} КБ`
                            : `${(a.size / 1024 / 1024).toFixed(1)} МБ`}{" "}
                          · {new Date(a.addedAt).toLocaleDateString("ru-RU")}
                        </small>
                      </button>
                      <select
                        aria-label={"Связать файл " + a.name + " с задачей"}
                        value={a.taskId}
                        onChange={(e) =>
                          update((s) => ({
                            ...s,
                            attachments: s.attachments.map((x) =>
                              x.id === a.id
                                ? { ...x, taskId: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      >
                        <option value="">Без задачи</option>
                        {state.tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                      <IconButton
                        label={"Открыть файл: " + a.name}
                        onClick={() =>
                          window.doit?.openFile(a.id).catch(notify)
                        }
                      >
                        <ArrowUpRight size={18} />
                      </IconButton>
                      <IconButton
                        label={"Убрать файл: " + a.name}
                        onClick={() => {
                          if (
                            confirm(
                              "Убрать документ из списка? Исходный файл останется на месте.",
                            )
                          )
                            update((s) => ({
                              ...s,
                              attachments: s.attachments.filter(
                                (x) => x.id !== a.id,
                              ),
                            }));
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
              <p className="footnote">
                Для переноса на другой компьютер используйте резервную копию в
                настройках. Удалённые вложения исключаются из копии; физическая
                очистка хранилища в этой версии не выполняется.
              </p>
            </>
          )}
          {view === "database" && (
            <>
              <div className="view-toolbar">
                <div className="filter-group">
                  <ListFilter size={17} />
                  <select
                    aria-label="Статус задач"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="active">Активные</option>
                    <option value="all">Все статусы</option>
                    <option value="completed">Выполненные</option>
                    <option value="high">Высокий приоритет</option>
                    <option value="overdue">Просроченные</option>
                  </select>
                  <select
                    aria-label="Фильтр по проекту"
                    value={dbProject}
                    onChange={(e) => setDbProject(e.target.value)}
                  >
                    <option value="">Все проекты</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  aria-label="Сортировка"
                  value={dbSort}
                  onChange={(e) => setDbSort(e.target.value)}
                >
                  <option value="date">По дате</option>
                  <option value="title">По названию</option>
                  <option value="created">Сначала новые</option>
                </select>
              </div>
              <div className="database-table">
                <table>
                  <thead>
                    <tr>
                      <th className="status-column">Статус</th>
                      <th>Название задачи</th>
                      <th>Проект</th>
                      <th>Дата</th>
                      <th>Приоритет</th>
                      <th>Подзадачи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.tasks
                      .filter(
                        (t) =>
                          (filter === "all" ||
                            (filter === "active" && !t.completed) ||
                            (filter === "completed" && t.completed) ||
                            (filter === "high" &&
                              t.priority === "high" &&
                              !t.completed) ||
                            (filter === "overdue" &&
                              t.date &&
                              t.date < today &&
                              !t.completed)) &&
                          (!dbProject || t.projectId === dbProject),
                      )
                      .sort((a, b) =>
                        dbSort === "title"
                          ? a.title.localeCompare(b.title, "ru")
                          : dbSort === "created"
                            ? b.createdAt.localeCompare(a.createdAt)
                            : (a.date || "9999").localeCompare(
                                b.date || "9999",
                              ),
                      )
                      .map((t) => (
                        <tr
                          key={t.id}
                          className={t.completed ? "completed" : ""}
                        >
                          <td>
                            <button
                              className={
                                "task-check " + (t.completed ? "checked" : "")
                              }
                              aria-label={"Изменить статус: " + t.title}
                              onClick={() => toggleTask(t.id)}
                            >
                              {t.completed && <Check size={13} />}
                            </button>
                          </td>
                          <td>
                            <button
                              className="table-title"
                              onClick={() => taskModal(t)}
                            >
                              {t.title}
                            </button>
                          </td>
                          <td>{projectName(t.projectId) || "—"}</td>
                          <td
                            className={
                              !t.completed && t.date && t.date < today
                                ? "overdue"
                                : ""
                            }
                          >
                            {formatDate(t.date)}
                          </td>
                          <td>
                            <span className={"priority-badge " + t.priority}>
                              {t.priority === "high"
                                ? "Высокий"
                                : t.priority === "low"
                                  ? "Низкий"
                                  : "Обычный"}
                            </span>
                          </td>
                          <td>
                            {t.subtasks.length
                              ? `${t.subtasks.filter((s) => s.completed).length} / ${t.subtasks.length}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!state.tasks.some(
                  (t) =>
                    (filter === "all" ||
                      (filter === "active" && !t.completed) ||
                      (filter === "completed" && t.completed) ||
                      (filter === "high" &&
                        t.priority === "high" &&
                        !t.completed) ||
                      (filter === "overdue" &&
                        t.date &&
                        t.date < today &&
                        !t.completed)) &&
                    (!dbProject || t.projectId === dbProject),
                ) && (
                  <Empty
                    icon={Table2}
                    title="Здесь пока нет задач"
                    text="Добавьте задачу или измените фильтры."
                  />
                )}
              </div>
              <p className="footnote">
                Единая база ваших задач: нажмите на название, чтобы изменить
                запись.
              </p>
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <span className="footer-dot" />
            Ваше пространство. Ваш ритм.
          </span>
          <span>
            {window.doit
              ? "Данные на устройстве · SQLite"
              : "Веб-режим · данные в этом браузере"}
          </span>
        </footer>
      </div>
      {modal?.type === "task" && (
        <TaskEditor
          task={modal.task}
          projects={state.projects}
          exists={state.tasks.some((t) => t.id === modal.task.id)}
          attachments={state.attachments.filter(
            (a) => a.taskId === modal.task.id,
          )}
          onClose={() => setModal(null)}
          onSave={saveTask}
          onDelete={() => removeTask(modal.task.id)}
          onAttach={() => attachFiles(modal.task.id)}
          busy={fileBusy}
          onError={notify}
        />
      )}
      {modal?.type === "note" && (
        <NoteEditor
          note={modal.note}
          onClose={() => setModal(null)}
          onSave={saveNote}
          onDelete={() => {
            if (confirm("Удалить заметку?")) {
              update((s) => ({
                ...s,
                notes: s.notes.filter((n) => n.id !== modal.note.id),
              }));
              setModal(null);
            }
          }}
        />
      )}
      {modal?.type === "goal" && (
        <GoalEditor
          goal={modal.goal}
          onClose={() => setModal(null)}
          onSave={saveGoal}
          onDelete={() => {
            if (confirm("Удалить цель?")) {
              update((s) => ({
                ...s,
                goals: s.goals.filter((g) => g.id !== modal.goal.id),
              }));
              setModal(null);
            }
          }}
        />
      )}
      {modal?.type === "project" && (
        <ProjectEditor
          onClose={() => setModal(null)}
          onSave={(name) => {
            const id = uid();
            update((s) => ({ ...s, projects: [...s.projects, { id, name }] }));
            setModal(null);
            navigate("project", id);
          }}
        />
      )}
      {modal?.type === "settings" && (
        <SettingsPanel
          state={state}
          update={update}
          onClose={() => setModal(null)}
          flush={flush}
          replace={replace}
          notify={setToast}
        />
      )}
      {!state.settings.onboardingDone && (
        <Welcome
          onStart={(name, examples) => {
            update((s) =>
              examples
                ? exampleState(name)
                : {
                    ...s,
                    settings: { ...s.settings, name, onboardingDone: true },
                  },
            );
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <IconButton label="Скрыть уведомление" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function TaskEditor({
  task,
  projects,
  exists,
  attachments,
  onClose,
  onSave,
  onDelete,
  onAttach,
  busy,
  onError,
}: {
  task: Task;
  projects: State["projects"];
  exists: boolean;
  attachments: State["attachments"];
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: () => void;
  onAttach: () => void;
  busy: boolean;
  onError: (error: unknown) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(task)),
    [sub, setSub] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(task);
  const close = () => {
    if (!changed || confirm("Закрыть без сохранения изменений?")) onClose();
  };
  return (
    <Modal
      title={exists ? "Детали задачи" : "Новая задача"}
      onClose={close}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.title.trim())
            onSave({ ...draft, title: draft.title.trim() });
        }}
      >
        <input
          className="editor-title"
          aria-label="Название задачи"
          placeholder="Что нужно сделать?"
          required
          maxLength={500}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="editor-description"
          aria-label="Описание задачи"
          placeholder="Описание, детали или небольшая подсказка себе…"
          maxLength={100000}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <div className="form-row">
          <label>
            Дата
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label>
            Проект
            <select
              value={draft.projectId}
              onChange={(e) =>
                setDraft({ ...draft, projectId: e.target.value })
              }
            >
              <option value="">Без проекта</option>
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Приоритет
            <select
              value={draft.priority}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  priority: e.target.value as Task["priority"],
                })
              }
            >
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="low">Низкий</option>
            </select>
          </label>
        </div>
        <div className="date-presets">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, date: dayKey() })}
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, date: offsetDay(1) })}
          >
            Завтра
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, date: "" })}
          >
            Без даты
          </button>
        </div>
        <div className="editor-section">
          <h3>
            Небольшие шаги <span>{draft.subtasks.length}</span>
          </h3>
          {draft.subtasks.map((s) => (
            <div className="subtask-row" key={s.id}>
              <button
                type="button"
                className={"task-check " + (s.completed ? "checked" : "")}
                aria-label={"Выполнить подзадачу: " + s.title}
                onClick={() =>
                  setDraft({
                    ...draft,
                    subtasks: draft.subtasks.map((x) =>
                      x.id === s.id ? { ...x, completed: !x.completed } : x,
                    ),
                  })
                }
              >
                {s.completed && <Check size={12} />}
              </button>
              <span className={s.completed ? "crossed" : ""}>{s.title}</span>
              <IconButton
                label={"Удалить подзадачу: " + s.title}
                onClick={() =>
                  setDraft({
                    ...draft,
                    subtasks: draft.subtasks.filter((x) => x.id !== s.id),
                  })
                }
              >
                <X size={15} />
              </IconButton>
            </div>
          ))}
          <div className="subtask-input">
            <Plus size={15} />
            <input
              aria-label="Новая подзадача"
              placeholder="Разбить на маленький шаг…"
              maxLength={500}
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (sub.trim()) {
                    setDraft({
                      ...draft,
                      subtasks: [
                        ...draft.subtasks,
                        { id: uid(), title: sub.trim(), completed: false },
                      ],
                    });
                    setSub("");
                  }
                }
              }}
            />
            <button
              type="button"
              className="text-button"
              disabled={!sub.trim()}
              onClick={() => {
                setDraft({
                  ...draft,
                  subtasks: [
                    ...draft.subtasks,
                    { id: uid(), title: sub.trim(), completed: false },
                  ],
                });
                setSub("");
              }}
            >
              Добавить
            </button>
          </div>
        </div>
        <div className="editor-section">
          <h3>
            Документы <span>{attachments.length}</span>
          </h3>
          {attachments.map((a) => (
            <button
              key={a.id}
              type="button"
              className="attachment-chip"
              onClick={() => window.doit?.openFile(a.id).catch(onError)}
            >
              <Paperclip size={14} />
              {a.name}
              <ArrowUpRight size={13} />
            </button>
          ))}
          {exists ? (
            <button
              type="button"
              disabled={busy}
              className="text-button"
              onClick={onAttach}
            >
              <Plus size={14} />
              {busy ? "Добавляем…" : "Прикрепить файл"}
            </button>
          ) : (
            <p className="muted small">
              Сохраните задачу, чтобы прикрепить документы.
            </p>
          )}
        </div>
        <div className="modal-footer">
          {exists ? (
            <IconButton
              label="Удалить задачу"
              className="danger"
              onClick={onDelete}
            >
              <Trash2 size={17} />
            </IconButton>
          ) : (
            <span />
          )}
          <div>
            <button type="button" className="button" onClick={close}>
              Отмена
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!draft.title.trim()}
            >
              <Check size={16} />
              Сохранить задачу
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
function NoteEditor({
  note,
  onClose,
  onSave,
  onDelete,
}: {
  note: Note;
  onClose: () => void;
  onSave: (n: Note) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({ ...note });
  const close = () => {
    if (
      JSON.stringify(draft) === JSON.stringify(note) ||
      confirm("Закрыть без сохранения заметки?")
    )
      onClose();
  };
  return (
    <Modal
      title={note.title ? "Редактировать запись" : "Новая мысль"}
      onClose={close}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...draft,
            title: draft.title.trim(),
            updatedAt: new Date().toISOString(),
          });
        }}
      >
        <div className="note-editor-tools">
          <div className="segmented">
            <button
              type="button"
              className={draft.kind === "note" ? "active" : ""}
              onClick={() => setDraft({ ...draft, kind: "note" })}
            >
              <FileText size={14} />
              Заметка
            </button>
            <button
              type="button"
              className={draft.kind === "idea" ? "active" : ""}
              onClick={() => setDraft({ ...draft, kind: "idea" })}
            >
              <Lightbulb size={14} />
              Идея
            </button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
            />
            <Pin size={14} />
            Закрепить
          </label>
        </div>
        <input
          className="editor-title"
          aria-label="Заголовок заметки"
          placeholder="Дайте мысли название"
          maxLength={500}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="note-editor-body"
          aria-label="Текст заметки"
          placeholder="Здесь можно думать вслух…"
          maxLength={100000}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div className="modal-footer">
          <IconButton
            label="Удалить заметку"
            className="danger"
            onClick={onDelete}
          >
            <Trash2 size={17} />
          </IconButton>
          <div>
            <button type="button" className="button" onClick={close}>
              Отмена
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!draft.title.trim() && !draft.body.trim()}
            >
              Сохранить заметку
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
function GoalEditor({
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  goal: Goal;
  onClose: () => void;
  onSave: (g: Goal) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({ ...goal });
  const close = () => {
    if (
      JSON.stringify(draft) === JSON.stringify(goal) ||
      confirm("Закрыть без сохранения цели?")
    )
      onClose();
  };
  return (
    <Modal title="Ваша цель" onClose={close}>
      <form
        className="standard-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...draft, title: draft.title.trim() });
        }}
      >
        <label>
          К чему вы хотите прийти?
          <input
            required
            maxLength={500}
            placeholder="Например, прочитать 12 книг"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          Зачем это вам?
          <textarea
            placeholder="Небольшое напоминание о том, что важно"
            maxLength={100000}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </label>
        <div className="form-row">
          <label>
            Сделано
            <input
              type="number"
              min={0}
              max={draft.target}
              required
              value={draft.progress}
              onChange={(e) =>
                setDraft({ ...draft, progress: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Всего
            <input
              type="number"
              min={Math.max(1, draft.progress)}
              max={1000000}
              required
              value={draft.target}
              onChange={(e) =>
                setDraft({ ...draft, target: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Единица
            <input
              maxLength={80}
              placeholder="книг"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            />
          </label>
        </div>
        <label>
          Желаемый срок <span className="muted">· необязательно</span>
          <input
            type="date"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
          />
        </label>
        <div className="modal-footer">
          <IconButton
            label="Удалить цель"
            className="danger"
            onClick={onDelete}
          >
            <Trash2 size={17} />
          </IconButton>
          <div>
            <button className="button" type="button" onClick={close}>
              Отмена
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={!draft.title.trim() || draft.progress > draft.target}
            >
              Сохранить цель
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
function ProjectEditor({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Modal title="Новый проект" onClose={onClose}>
      <form
        className="standard-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <p className="muted">
          Объедините задачи по работе, учёбе или личным планам.
        </p>
        <label>
          Название
          <input
            required
            maxLength={100}
            placeholder="Например, Ремонт или Новый проект"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="modal-footer">
          <span />
          <button className="button primary" disabled={!name.trim()}>
            Создать проект
          </button>
        </div>
      </form>
    </Modal>
  );
}
function WeatherCard({
  city,
  onSettings,
}: {
  city: City | null;
  onSettings: () => void;
}) {
  const [weather, setWeather] = useState<Weather | null>(null),
    [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setWeather(null);
    setFailed(false);
    if (!city || !window.doit) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await window.doit!.weather(city);
        if (active) {
          setWeather(data);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [city?.latitude, city?.longitude, attempt]);
  const description = weather
    ? weather.code === 0
      ? "Ясное небо"
      : weather.code <= 3
        ? "Переменная облачность"
        : weather.code < 50
          ? "Туман"
          : weather.code < 70
            ? "Дождь"
            : weather.code < 80
              ? "Снег"
              : weather.code < 95
                ? "Ливни"
                : "Гроза"
    : "";
  return (
    <section className="rail-card weather-card">
      <div className="rail-heading">
        <h3>
          <CloudSun size={17} />
          За окном
        </h3>
        <button className="text-button city-button" onClick={onSettings}>
          {city ? city.name.split(",")[0] : "Выбрать город"}
          <ChevronDown size={12} />
        </button>
      </div>
      {weather ? (
        <>
          <div className="weather-main">
            <strong>
              {Math.round(weather.temperature)}
              <span>°</span>
            </strong>
            <CloudSun size={61} strokeWidth={1} />
          </div>
          <div className="weather-bottom">
            <span>{description}</span>
            <span>
              ↑ {Math.round(weather.high)}° &nbsp; ↓ {Math.round(weather.low)}°
            </span>
          </div>
          <span className="weather-source">
            Open-Meteo ·{" "}
            {new Date(weather.updatedAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </>
      ) : (
        <div className="weather-empty">
          <CloudSun size={39} strokeWidth={1.1} />
          <p>
            {loading
              ? "Узнаём погоду…"
              : failed
                ? "Не удалось загрузить погоду"
                : city
                  ? "Погода доступна в приложении Windows"
                  : "Немного контекста для ваших планов"}
          </p>
          {failed ? (
            <button
              className="text-button"
              onClick={() => setAttempt((x) => x + 1)}
            >
              Повторить
            </button>
          ) : (
            !loading && (
              <button className="text-button" onClick={onSettings}>
                Указать город <ArrowRight size={13} />
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}
function SettingsPanel({
  state,
  update,
  onClose,
  flush,
  replace,
  notify,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
  onClose: () => void;
  flush: () => Promise<void>;
  replace: (s: State) => void;
  notify: (message: string) => void;
}) {
  const account = useAccount();
  const [name, setName] = useState(state.settings.name),
    [query, setQuery] = useState(""),
    [cities, setCities] = useState<City[]>([]),
    [busy, setBusy] = useState(false),
    [backupBusy, setBackupBusy] = useState(false),
    [cityError, setCityError] = useState("");
  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.doit) {
      setCityError("Поиск города доступен в Windows-приложении.");
      return;
    }
    setBusy(true);
    setCityError("");
    try {
      const data = await window.doit.searchCity(query);
      setCities(data);
      if (!data.length)
        setCityError("Город не найден. Попробуйте название латиницей.");
    } catch {
      setCityError(
        "Не удалось связаться с сервисом. Проверьте интернет и попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  };
  const backup = async (action: "export" | "import") => {
    if (!window.doit) {
      notify("Резервные копии с файлами доступны в Windows-приложении.");
      return;
    }
    setBackupBusy(true);
    try {
      await flush();
      if (action === "export") {
        if (await window.doit.exportBackup())
          notify("Копия с документами сохранена");
      } else {
        const next = await window.doit.importBackup();
        if (next) {
          replace(next);
          setName(next.settings.name);
          notify("Данные и документы восстановлены");
        }
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBackupBusy(false);
    }
  };
  return (
    <Modal title="Настройки пространства" onClose={onClose}>
      <div className="settings-content">
        <ThemePicker state={state} update={update} />
        <DesktopSettings flush={flush} notify={notify} />
        <section>
          <h3>Как к вам обращаться?</h3>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              update((s) => ({
                ...s,
                settings: { ...s.settings, name: name.trim() },
              }));
              notify("Имя сохранено");
            }}
          >
            <input
              aria-label="Ваше имя"
              placeholder="Ваше имя"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="button">Сохранить</button>
          </form>
        </section>
        <section>
          <h3>
            <CloudSun size={17} />
            Погода
          </h3>
          <p>
            Город выбираете вы. Геолокация не запрашивается. Прогноз получает
            Open-Meteo по координатам выбранного города.
          </p>
          {state.settings.city && (
            <div className="selected-city">
              <span>{state.settings.city.name}</span>
              <IconButton
                label="Убрать город"
                onClick={() =>
                  update((s) => ({
                    ...s,
                    settings: { ...s.settings, city: null },
                  }))
                }
              >
                <X size={15} />
              </IconButton>
            </div>
          )}
          <form className="inline-form" onSubmit={search}>
            <input
              aria-label="Город для погоды"
              placeholder="Название города"
              minLength={2}
              maxLength={200}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="button"
              disabled={busy || query.trim().length < 2}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Search size={16} />
              )}
              Найти
            </button>
          </form>
          {cityError && (
            <p className="inline-error" role="alert">
              {cityError}
            </p>
          )}
          <div className="city-results">
            {cities.map((c) => (
              <button
                key={c.name + c.latitude}
                onClick={() => {
                  update((s) => ({
                    ...s,
                    settings: { ...s.settings, city: c },
                  }));
                  setCities([]);
                  setQuery("");
                  notify("Город для погоды сохранён");
                }}
              >
                {c.name}
                <Plus size={14} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>
            <HardDrive size={17} />
            Данные и резервная копия
          </h3>
          <p>
            {account.profile
              ? "Копия аккаунта .doit зашифрована вашим паролем и включает документы. Восстановить её можно на экране входа через «Из копии». Кнопка «Восстановить» ниже импортирует старую ZIP-копию версии 0.1."
              : "Задачи, заметки и цели хранятся локально. ZIP-копия гостя включает документы и не зашифрована: храните её в надёжном месте."}
          </p>
          <div className="settings-buttons">
            <button
              className="button"
              disabled={backupBusy}
              onClick={() => backup("export")}
            >
              <ArrowDownToLine size={16} />
              Сохранить копию
            </button>
            <button
              className="button"
              disabled={backupBusy}
              onClick={() => backup("import")}
            >
              <Upload size={16} />
              Восстановить
            </button>
          </div>
        </section>
        <section>
          <h3>Нужен пример?</h3>
          <p>
            Добавьте несколько демонстрационных задач, целей и заметок. Ваши
            записи сохранятся.
          </p>
          <button
            className="button"
            onClick={() => {
              const example = exampleState(state.settings.name);
              update((s) => ({
                ...s,
                tasks: [...s.tasks, ...example.tasks],
                projects: [...s.projects, ...example.projects],
                notes: [...s.notes, ...example.notes],
                goals: [...s.goals, ...example.goals],
              }));
              notify("Примеры добавлены");
            }}
          >
            <Sparkles size={16} />
            Добавить примеры
          </button>
        </section>
        <div className="about">
          <span className="brand-word">DoIT</span>
          <span>Версия 0.2.0 · Для спокойных, осмысленных дней.</span>
        </div>
      </div>
    </Modal>
  );
}
function Welcome({
  onStart,
}: {
  onStart: (name: string, examples: boolean) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        <span className="brand-symbol">
          d<span>·</span>
        </span>
        <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ В DOIT</span>
        <h1>
          Всё важное.
          <br />В одном тихом месте.
        </h1>
        <p>
          Задачи, планы и мысли — без лишнего шума.
          <br />
          Ваше личное пространство, в вашем ритме.
        </p>
        <div className="welcome-features">
          <span>
            <CheckCheck size={17} />
            Задачи и планы
          </span>
          <span>
            <FileText size={17} />
            Мысли и идеи
          </span>
          <span>
            <Target size={17} />
            Личные цели
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart(name.trim(), false);
          }}
        >
          <label htmlFor="welcome-name">
            Как к вам обращаться? <span>Необязательно</span>
          </label>
          <input
            id="welcome-name"
            placeholder="Ваше имя"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="button primary">
            Начать с чистого листа <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="welcome-example"
          onClick={() => onStart(name.trim(), true)}
        >
          Сначала посмотреть на примере <ArrowUpRight size={14} />
        </button>
        <small>
          <HardDrive size={13} />
          Можно работать без интернета. Данные на устройстве.
        </small>
      </div>
    </div>
  );
}
