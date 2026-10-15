import type { CalendarMode } from "./models.ts";
import { shiftDay } from "./data.ts";
export function weekStart(day: string) {
  return shiftDay(day, -new Date(day + "T12:00:00").getDay());
}
export function calendarRange(
  day: string,
  mode: CalendarMode,
): [string, string] {
  const start =
    mode === "month"
      ? weekStart(day.slice(0, 7) + "-01")
      : mode === "week"
        ? weekStart(day)
        : day;
  return [
    start,
    shiftDay(start, mode === "month" ? 42 : mode === "week" ? 7 : 1),
  ];
}
