export const MEMORY_STATUSES = [
  "draft",
  "awaiting_payment",
  "paid",
  "scheduled",
  "published",
  "deleted",
] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

// Mirrors private.memory_transition_allowed in the database, which is the
// authority. Kept here so the UI never offers an action the database refuses.
const TRANSITIONS: Record<MemoryStatus, readonly MemoryStatus[]> = {
  draft: ["awaiting_payment", "deleted"],
  awaiting_payment: ["draft", "paid", "scheduled", "published", "deleted"],
  paid: ["scheduled", "published", "deleted"],
  scheduled: ["published", "deleted"],
  published: ["deleted"],
  deleted: [],
};

export function canTransition(from: MemoryStatus, to: MemoryStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isEditable(status: MemoryStatus): boolean {
  return status === "draft";
}

export function isLive(status: MemoryStatus): boolean {
  return status === "scheduled" || status === "published";
}

export function isMemoryStatus(value: unknown): value is MemoryStatus {
  return typeof value === "string" && (MEMORY_STATUSES as readonly string[]).includes(value);
}
