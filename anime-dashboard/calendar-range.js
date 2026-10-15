import { shiftDay } from "./data.js";
export function weekStart(day) {
  return shiftDay(day, -new Date(day + "T12:00:00").getDay());
}
export function calendarRange(day, mode) {
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
