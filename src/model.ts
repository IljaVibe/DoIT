export type Task = {
  id: string;
  title: string;
  description: string;
  date: string;
  priority: "normal" | "high" | "low";
  projectId: string;
  completed: boolean;
  createdAt: string;
  subtasks: { id: string; title: string; completed: boolean }[];
};
export type Note = {
  id: string;
  title: string;
  body: string;
  kind: "note" | "idea";
  pinned: boolean;
  updatedAt: string;
};
export type Goal = {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  unit: string;
  deadline: string;
};
export type Attachment = {
  id: string;
  name: string;
  size: number;
  storageKey: string;
  taskId: string;
  addedAt: string;
};
export type City = { name: string; latitude: number; longitude: number };
export type Weather = {
  temperature: number;
  code: number;
  high: number;
  low: number;
  updatedAt: string;
};
export type State = {
  version: 1;
  tasks: Task[];
  notes: Note[];
  goals: Goal[];
  projects: { id: string; name: string }[];
  attachments: Attachment[];
  settings: {
    name: string;
    city: City | null;
    onboardingDone: boolean;
    theme?: Theme;
  };
};
export type Theme = "sage" | "sand" | "mist" | "lavender" | "graphite";
export type AccountInfo = { id: string; name: string; createdAt: string };
export type AuthInfo = {
  session: "locked" | "guest" | "account";
  profile: AccountInfo | null;
  accounts: AccountInfo[];
  hasLegacy: boolean;
};
export type DesktopPreferences = {
  autoStart: boolean;
  closeToTray: boolean;
  widgets: { tasks: boolean; goals: boolean; note: boolean };
  alwaysOnTop: boolean;
  autoStartSupported: boolean;
  backupFolder: string;
  backupLastAt: string;
  backupError: string;
};
export type View =
  | "today"
  | "inbox"
  | "calendar"
  | "goals"
  | "notes"
  | "files"
  | "database"
  | "project";
export const uid = () => crypto.randomUUID();
export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const offsetDay = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dayKey(date);
};
export const formatDate = (
  value: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("ru-RU", opts)
    : "Без даты";
export const emptyState = (): State => ({
  version: 1,
  tasks: [],
  notes: [],
  goals: [],
  projects: [],
  attachments: [],
  settings: { name: "", city: null, onboardingDone: false },
});
export const newTask = (date = "", projectId = ""): Task => ({
  id: uid(),
  title: "",
  description: "",
  date,
  projectId,
  completed: false,
  priority: "normal",
  subtasks: [],
  createdAt: new Date().toISOString(),
});
export function exampleState(name: string): State {
  const personal = uid(),
    work = uid(),
    study = uid();
  const task = (
    title: string,
    projectId: string,
    date = dayKey(),
    extra: Partial<Task> = {},
  ): Task => ({ ...newTask(date, projectId), title, ...extra });
  return {
    version: 1,
    settings: { name, city: null, onboardingDone: true },
    projects: [
      { id: personal, name: "Личное" },
      { id: work, name: "Работа" },
      { id: study, name: "Развитие" },
    ],
    attachments: [],
    tasks: [
      task("Наметить главное на эту неделю", personal, dayKey(), {
        priority: "high",
        description: "Выбрать три дела, которые действительно имеют значение.",
        subtasks: [
          { id: uid(), title: "Посмотреть календарь", completed: true },
          { id: uid(), title: "Записать три приоритета", completed: false },
        ],
      }),
      task("Собрать идеи для нового проекта", work, dayKey(), {
        description:
          "Сначала записать всё, что приходит в голову. Оценивать будем потом.",
      }),
      task("Почитать 20 минут", study),
      task("Прогуляться без телефона", personal, dayKey(), { priority: "low" }),
      task("Разобрать входящие", work, dayKey(), { completed: true }),
      task("Подготовить план проекта", work, offsetDay(2)),
      task("Записаться на тренировку", personal, offsetDay(3)),
      task("Найти интересный курс", study, ""),
      task("Обновить список книг", personal, ""),
    ],
    goals: [
      {
        id: uid(),
        title: "Читать понемногу каждый день",
        description: "Не спешить. Одна хорошая книга за другой.",
        target: 12,
        progress: 4,
        unit: "книг",
        deadline: dayKey(new Date(new Date().getFullYear(), 11, 31)),
      },
      {
        id: uid(),
        title: "Больше движения",
        description: "Прогулки, тренировки и время на свежем воздухе.",
        target: 20,
        progress: 7,
        unit: "прогулок",
        deadline: offsetDay(30),
      },
    ],
    notes: [
      {
        id: uid(),
        title: "Меньше шума, больше смысла",
        body: "Хочу оставлять в дне место для того, что мне важно.\n\n• Одно главное дело\n• Немного движения\n• Время без экрана\n\nНе обязательно успеть всё. Достаточно двигаться в своём темпе.",
        kind: "note",
        pinned: true,
        updatedAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: "А что, если…",
        body: "Собрать маленький личный проект, который давно откладываю.\n\nНачать с простого прототипа и дать себе две недели на эксперимент.",
        kind: "idea",
        pinned: false,
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}
export interface DesktopAPI {
  authInfo(): Promise<AuthInfo>;
  createAccount(
    name: string,
    password: string,
    migrate: boolean,
  ): Promise<AuthInfo>;
  login(id: string, password: string): Promise<AuthInfo>;
  logout(): Promise<void>;
  guest(): Promise<AuthInfo>;
  restoreAccount(password: string): Promise<AuthInfo | null>;
  onAuthChanged(callback: (info: AuthInfo) => void): () => void;
  desktopPreferences(): Promise<DesktopPreferences>;
  setDesktopPreferences(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences>;
  chooseBackupFolder(): Promise<DesktopPreferences>;
  backupNow(): Promise<DesktopPreferences>;
  onBeforeClose(callback: () => Promise<boolean>): () => void;
  onLockRequested(callback: () => void): () => void;
  onPatch(
    callback: (patch: {
      collection: "tasks" | "notes" | "goals";
      record: Task | Note | Goal;
    }) => void,
  ): () => void;
  load(): Promise<State>;
  save(state: State): Promise<State>;
  attach(): Promise<Attachment[]>;
  openFile(id: string): Promise<void>;
  exportBackup(): Promise<boolean>;
  importBackup(): Promise<State | null>;
  searchCity(q: string): Promise<City[]>;
  weather(city: City): Promise<Weather>;
}
declare global {
  interface Window {
    doit?: DesktopAPI;
  }
}
