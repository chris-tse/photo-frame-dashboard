export type CalendarMode = "day" | "week" | "month";
export type View = "home" | "shopping" | "tasks" | "calendar";
export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  store: string;
  qty: number;
  done: boolean;
}
export interface Task {
  id: string;
  title: string;
  person: string;
  routine: string;
  done: boolean;
}
export interface HouseholdEvent {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  person: string;
  location: string;
}
export interface Household {
  version: 2;

  note: string;
  shopping: ShoppingItem[];
  tasks: Task[];
  events: HouseholdEvent[];
}
interface EventDetails {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
}
export type WorkEvent = EventDetails &
  (
    { isAllDay: true; startDate: string; endDate: string } | { isAllDay: false }
  );
export type GatewayStatus =
  | { available: true; busy: boolean }
  | { available: false; busy: false; unavailableReason: string };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected an object.");
  return value;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected text.");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Expected a boolean.");
  return value;
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Expected a list.");
  return value.map(parse);
}
export function parseHousehold(value: unknown): Household {
  const source = record(value);
  if (source.version !== 2) throw new Error("Unsupported household version.");
  return {
    version: 2,

    note: string(source.note),
    shopping: array(source.shopping, (value) => {
      const item = record(value);
      if (
        typeof item.qty !== "number" ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 99
      )
        throw new Error("Invalid quantity.");
      return {
        id: string(item.id),
        name: string(item.name),
        category: string(item.category),
        store: string(item.store),
        qty: item.qty,
        done: boolean(item.done),
      };
    }),
    tasks: array(source.tasks, (value) => {
      const item = record(value);
      return {
        id: string(item.id),
        title: string(item.title),
        person: string(item.person),
        routine: string(item.routine),
        done: boolean(item.done),
      };
    }),
    events: array(source.events, (value) => {
      const item = record(value);
      return {
        id: string(item.id),
        title: string(item.title),
        date: string(item.date),
        start: string(item.start),
        end: string(item.end),
        person: string(item.person),
        location: string(item.location),
      };
    }),
  };
}
export function parseWorkEvent(value: unknown): WorkEvent {
  const item = record(value);
  const start = string(item.start),
    end = string(item.end);
  if (
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start)
  )
    throw new Error("Invalid event timestamps.");
  const details = {
    id: string(item.id),
    title: string(item.title),
    start,
    end,
    location: item.location == null ? null : string(item.location),
  };
  if (boolean(item.isAllDay)) {
    const startDate = string(item.startDate),
      endDate = string(item.endDate);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      endDate <= startDate
    )
      throw new Error("Invalid all-day event dates.");
    return { ...details, isAllDay: true, startDate, endDate };
  }
  return { ...details, isAllDay: false };
}
export function parseStatus(value: unknown): GatewayStatus {
  const item = record(value);
  return boolean(item.available)
    ? { available: true, busy: boolean(item.busy) }
    : {
        available: false,
        busy: false,
        unavailableReason: string(item.unavailableReason),
      };
}
export function isView(value: string): value is View {
  return (
    value === "home" ||
    value === "shopping" ||
    value === "tasks" ||
    value === "calendar"
  );
}
