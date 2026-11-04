const { z } = require("zod");
const id = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00");
    return (
      !isNaN(+d) &&
      d.getFullYear() === +s.slice(0, 4) &&
      d.getMonth() + 1 === +s.slice(5, 7) &&
      d.getDate() === +s.slice(8, 10)
    );
  });
const text = z.string().max(100000);
const task = z.object({
  id,
  title: z.string().trim().min(1).max(500),
  description: text,
  date: date.or(z.literal("")),
  priority: z.enum(["normal", "high", "low"]),
  projectId: id.or(z.literal("")),
  completed: z.boolean(),
  createdAt: z.string(),
  subtasks: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(500),
        completed: z.boolean(),
      }),
    )
    .max(500),
});
const note = z.object({
  id,
  title: z.string().max(500),
  body: text,
  kind: z.enum(["note", "idea"]),
  pinned: z.boolean(),
  updatedAt: z.string(),
});
const goal = z
  .object({
    id,
    title: z.string().trim().min(1).max(500),
    description: text,
    target: z.number().int().min(1).max(1000000),
    progress: z.number().int().min(0).max(1000000),
    unit: z.string().max(80),
    deadline: date.or(z.literal("")),
  })
  .refine((g) => g.progress <= g.target, {
    message: "Прогресс не может превышать цель",
  });
const attachment = z.object({
  id,
  name: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .min(0)
    .max(100 * 1024 * 1024),
  storageKey: z.string().regex(/^[a-f0-9-]{36}(\.[a-z0-9]{1,12})?$/),
  taskId: id.or(z.literal("")),
  addedAt: z.string(),
});
const stateSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(task).max(20000),
    notes: z.array(note).max(10000),
    goals: z.array(goal).max(10000),
    projects: z
      .array(z.object({ id, name: z.string().trim().min(1).max(100) }))
      .max(200),
    attachments: z.array(attachment).max(10000),
    settings: z.object({
      name: z.string().max(60),
      city: z
        .object({
          name: z.string().max(200),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
        .nullable(),
      onboardingDone: z.boolean(),
    }),
  })
  .superRefine((s, ctx) => {
    for (const key of ["tasks", "notes", "goals", "projects", "attachments"])
      if (new Set(s[key].map((x) => x.id)).size !== s[key].length)
        ctx.addIssue({ code: "custom", message: `Повторяющиеся ID: ${key}` });
  });
module.exports = {
  stateSchema,
  citySchema: stateSchema.shape.settings.shape.city,
};
