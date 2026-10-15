import { House, ShoppingBasket, ListChecks, CalendarDays, Sun, Moon } from "lucide-react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import type {
  CalendarMode,
  View,
  Household,
  HouseholdEvent,
  ShoppingItem,
  WorkEvent,
} from "./models.ts";
import { isView, parseHousehold } from "./models.ts";
type Update = Dispatch<SetStateAction<Household>>;
type Notify = (message: string) => void;
type OpenWork = (events: WorkEvent[], title: string) => void;
type AppDialog =
  | { kind: "event"; event: HouseholdEvent }
  | { kind: "connection" }
  | { kind: "work"; events: WorkEvent[]; title: string };
const personStyle = (
  color: string,
): CSSProperties & { "--person": string } => ({ "--person": color });
function formText(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error("Missing form field: " + name);
  return value;
}
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { createGateway, eventOnDay } from "./calendar-gateway.ts";
import { TIME_ZONE, people, person, seed, todayKey, shiftDay } from "./data.ts";
import { calendarRange } from "./calendar-range.ts";
import { useCalendar } from "./use-calendar.ts";

const storageKey = "komorebi-household-v2";
const navigationIcons = { home: House, shopping: ShoppingBasket, tasks: ListChecks, calendar: CalendarDays };
const views: View[] = ["home", "shopping", "tasks", "calendar"];
const categories = [
  "Produce",
  "Bakery",
  "Fridge",
  "Pantry",
  "Frozen",
  "Home",
  "Other",
];
const calendarModes: CalendarMode[] = ["day", "week", "month"];
const routines = ["Morning", "Afternoon", "Evening"];
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dayLabel = (
  day: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) => new Date(day + "T12:00:00").toLocaleDateString("en-US", options);
const timeLabel = (value: string) => {
  const [h, m] = value.split(":");
  return `${Number(h) % 12 || 12}:${m}${Number(h) < 12 ? " am" : " pm"}`;
};
const workTime = (event: WorkEvent) =>
  event.isAllDay
    ? "All day"
    : new Date(event.start).toLocaleTimeString("en-US", {
        timeZone: TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
      });
function readHousehold(): Household {
  try {
    return parseHousehold(
      JSON.parse(localStorage.getItem(storageKey) || "null"),
    );
  } catch {
    return seed();
  }
}
function Options({ values }: { values: string[] }) {
  return values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));
}
function PeopleOptions({ all = true }) {
  return (
    <>
      {all && <option value="all">Everyone</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  );
}
function Checkbox({ checked = false }: { checked?: boolean }) {
  return (
    <span
      className={"checkbox" + (checked ? " checked" : "")}
      aria-hidden="true"
    />
  );
}
function Dialog({
  id,
  title,
  close,
  children,
}: {
  id: string;
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog id={id} ref={ref} onCancel={close}>
      <div className="section-heading">
        <h2 id={id + "-title"}>{title}</h2>
        <button type="button" onClick={close} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Home({
  state,
  update,
  navigate,
  openEvent,
  showPerson,
}: {
  state: Household;
  update: Update;
  navigate: (view: View) => void;
  openEvent: (event: HouseholdEvent) => void;
  showPerson: (id: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const minutes =
    ((Number(part("hour")) % 12) + (part("dayPeriod") === "PM" ? 12 : 0)) * 60 +
    Number(part("minute"));
  const today = todayKey();
  const upcoming = state.events
    .filter(
      (e) =>
        e.date > today ||
        (e.date === today &&
          Number(e.end.slice(0, 2)) * 60 + Number(e.end.slice(3)) > minutes),
    )
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const next = upcoming[0];
  return (
    <div className="home-screen">
      <section
        className="home-window"
        aria-label="Clock and coastal photograph"
      >
        <div className="clock-block">
          <p id="home-date">{dayLabel(today)}</p>
          <div className="clock">
            <time id="home-clock">
              {part("hour")}:{part("minute")}
            </time>
            <span id="home-period">{part("dayPeriod")}</span>
          </div>
        </div>
        <div className="photo-wrap">
          <img
            src="/coastal-train.jpg"
            alt="An Enoden train beside the sea in Fujisawa, Japan, photographed by Sunil Poudel."
          />
          <div className="photo-caption">
            <span>Sunil Poudel · Pexels</span>
          </div>
        </div>
      </section>
      <section className="home-day">
        <div className="family-strip">
          {people.map((p) => (
            <button
              key={p.id}
              data-family={p.id}
              onClick={() => showPerson(p.id)}
            >
              <span className="avatar" style={personStyle(p.color)}>
                {p.name[0]}
              </span>
              <span>
                <strong>{p.name}</strong>
                <small>
                  {
                    state.tasks.filter((t) => t.person === p.id && !t.done)
                      .length
                  }{" "}
                  tasks left
                </small>
              </span>
            </button>
          ))}
        </div>
        {next ? (
          <button
            className="next-event"
            data-event={next.id}
            onClick={() => openEvent(next)}
          >
            <div>
              <span>
                {next.date === today ? "Next event" : "Upcoming"} ·{" "}
                {person(next.person).name}
              </span>
              <h2>{next.title}</h2>
              <p>
                {next.location}
                {next.date !== today &&
                  " · " +
                    dayLabel(next.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
              </p>
            </div>
            <strong>{timeLabel(next.start)}</strong>
          </button>
        ) : (
          <div className="next-event">
            <h2>No upcoming events.</h2>
          </div>
        )}
        <section>
          <div className="section-heading">
            <h2>Today</h2>
            <button
              className="text-button"
              data-go="calendar"
              onClick={() => navigate("calendar")}
            >
              Open calendar →
            </button>
          </div>
          <div className="home-agenda">
            {upcoming
              .filter((e) => e.date === today)
              .slice(0, 3)
              .map((e) => (
                <button
                  key={e.id}
                  data-event={e.id}
                  onClick={() => openEvent(e)}
                >
                  <span
                    className="person-dot"
                    style={personStyle(person(e.person).color)}
                    aria-hidden="true"
                  />
                  <time>{timeLabel(e.start)}</time>
                  <strong>{e.title}</strong>
                  <span>{person(e.person).name}</span>
                </button>
              ))}
            {!upcoming.some((e) => e.date === today) && (
              <p className="empty">No more events today.</p>
            )}
          </div>
        </section>
        <div className="home-summary">
          <button data-go="tasks" onClick={() => navigate("tasks")}>
            <span>Tasks</span>
            <strong>
              {state.tasks.filter((t) => t.done).length}
              <small> / {state.tasks.length}</small>
            </strong>
          </button>
          <button data-go="shopping" onClick={() => navigate("shopping")}>
            <span>Shopping</span>
            <strong>
              {state.shopping.filter((i) => !i.done).length}
              <small> items</small>
            </strong>
          </button>
        </div>
        <label className="home-note">
          Note
          <input
            id="home-note"
            maxLength={300}
            placeholder="Add a note"
            value={state.note || ""}
            onChange={(e) => {
              update((s) => ({ ...s, note: e.target.value }));
              setSaved(true);
            }}
          />
          <span id="note-status" role="status">
            {saved ? "Saved" : ""}
          </span>
        </label>
      </section>
    </div>
  );
}
function Shopping({
  state,
  update,
  notify,
}: {
  state: Household;
  update: Update;
  notify: Notify;
}) {
  const [store, setStore] = useState("All");
  const items = state.shopping.filter(
      (i) => store === "All" || i.store === store,
    ),
    open = items.filter((i) => !i.done),
    checked = items.filter((i) => i.done);
  function change(id: string, fn: (item: ShoppingItem) => ShoppingItem) {
    update((s) => ({
      ...s,
      shopping: s.shopping.map((i) => (i.id === id ? fn(i) : i)),
    }));
  }
  function add(
    name: string,
    category = "Other",
    targetStore = store === "All" ? "Market" : store,
  ) {
    name = name.trim();
    if (!name) return;
    update((s) => {
      const found = s.shopping.find(
        (i) =>
          i.name.toLowerCase() === name.toLowerCase() &&
          i.store === targetStore,
      );
      return {
        ...s,
        shopping: found
          ? s.shopping.map((i) =>
              i.id === found.id
                ? {
                    ...i,
                    qty: i.done ? 1 : Math.min(99, i.qty + 1),
                    done: false,
                  }
                : i,
            )
          : [
              ...s.shopping,
              {
                id: uid(),
                name,
                category,
                store: targetStore,
                qty: 1,
                done: false,
              },
            ],
      };
    });
    notify("Item added.");
  }
  return (
    <section className="screen shopping-screen">
      <header className="screen-heading">
        <div>
          <h1>Shopping</h1>
          <p>{open.length} items remaining</p>
        </div>
        <label className="select-label">
          Store
          <select
            id="store-filter"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          >
            <Options values={["All", "Market", "Superstore"]} />
          </select>
        </label>
      </header>
      <div className="shopping-layout">
        <div className="scroll-panel shopping-list">
          {categories.map((category) => {
            const group = open.filter((i) => i.category === category);
            return group.length ? (
              <section key={category} className="shopping-category">
                <h2>
                  {category}
                  <span>{group.length}</span>
                </h2>
                {group.map((i) => (
                  <div key={i.id} className="shopping-row">
                    <button
                      className="check-item"
                      data-shop-check={i.id}
                      onClick={() =>
                        change(i.id, (i) => ({ ...i, done: !i.done }))
                      }
                    >
                      <Checkbox />
                      <span>
                        <strong>{i.name}</strong>
                        <small>{i.store}</small>
                      </span>
                    </button>
                    <div className="quantity">
                      <button
                        data-quantity="-1"
                        data-id={i.id}
                        aria-label={"Less " + i.name}
                        onClick={() =>
                          change(i.id, (i) => ({
                            ...i,
                            qty: Math.max(1, i.qty - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span>{i.qty}</span>
                      <button
                        data-quantity="1"
                        data-id={i.id}
                        aria-label={"More " + i.name}
                        onClick={() =>
                          change(i.id, (i) => ({
                            ...i,
                            qty: Math.min(99, i.qty + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null;
          })}
          {!open.length && <p className="empty">No items remaining.</p>}
          <details className="checked-list" open={checked.length > 0}>
            <summary>
              Checked <span>{checked.length}</span>
            </summary>
            {checked.map((i) => (
              <button
                key={i.id}
                data-shop-check={i.id}
                onClick={() => change(i.id, (i) => ({ ...i, done: false }))}
              >
                <Checkbox checked />
                {i.name}
                <small>Add back</small>
              </button>
            ))}
          </details>
        </div>
        <aside className="shopping-aside">
          <section className="flat-panel">
            <h2>Add item</h2>
            <form
              id="shopping-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                add(
                  formText(form, "name"),
                  formText(form, "category"),
                  formText(form, "store"),
                );
                e.currentTarget.reset();
              }}
            >
              <label>
                Item
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="Item name"
                  autoComplete="off"
                />
              </label>
              <div className="form-two">
                <label>
                  Category
                  <select name="category">
                    <Options values={categories} />
                  </select>
                </label>
                <label>
                  Store
                  <select
                    name="store"
                    defaultValue={store === "Superstore" ? store : "Market"}
                    key={store}
                  >
                    <Options values={["Market", "Superstore"]} />
                  </select>
                </label>
              </div>
              <button className="solid" type="submit">
                Add item
              </button>
            </form>
          </section>
          <section className="usuals">
            <h2>Quick add</h2>
            <div>
              {["Bananas", "Bread", "Milk", "Eggs", "Coffee beans", "Rice"].map(
                (name) => (
                  <button
                    key={name}
                    data-usual={name}
                    onClick={() => add(name)}
                  >
                    {name}
                    <span>+</span>
                  </button>
                ),
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
function Tasks({
  state,
  update,
  notify,
  taskPerson,
  setTaskPerson,
}: {
  state: Household;
  update: Update;
  notify: Notify;
  taskPerson: string;
  setTaskPerson: (id: string) => void;
}) {
  const [routine, setRoutine] = useState("All");
  const filtered = state.tasks.filter(
    (t) =>
      (routine === "All" || t.routine === routine) &&
      (taskPerson === "all" || t.person === taskPerson),
  );
  return (
    <section className="screen tasks-screen">
      <header className="screen-heading">
        <div>
          <h1>Tasks</h1>
          <p>
            {state.tasks.filter((t) => t.done).length} of {state.tasks.length}{" "}
            completed
          </p>
        </div>
        <label className="select-label">
          Person
          <select
            id="task-person"
            value={taskPerson}
            onChange={(e) => setTaskPerson(e.target.value)}
          >
            <PeopleOptions />
          </select>
        </label>
      </header>
      <div className="routine-tabs" aria-label="Task routine">
        {["All", ...routines].map((r) => (
          <button
            key={r}
            data-routine={r}
            aria-pressed={r === routine}
            onClick={() => setRoutine(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="task-boards scroll-panel">
        {people
          .filter((p) => taskPerson === "all" || p.id === taskPerson)
          .map((p) => {
            const list = filtered.filter((t) => t.person === p.id);
            return (
              <section
                key={p.id}
                className="task-board"
                style={personStyle(p.color)}
              >
                <div className="person-heading">
                  <span className="avatar">{p.name[0]}</span>
                  <div>
                    <h2>{p.name}</h2>
                    <p>
                      {list.filter((t) => t.done).length} of {list.length}{" "}
                      finished
                    </p>
                  </div>
                </div>
                {list.map((t) => (
                  <div
                    key={t.id}
                    className={"task-row" + (t.done ? " done" : "")}
                  >
                    <button
                      data-task-check={t.id}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          tasks: s.tasks.map((item) =>
                            item.id === t.id
                              ? { ...item, done: !item.done }
                              : item,
                          ),
                        }))
                      }
                    >
                      <Checkbox checked={t.done} />
                      <span>
                        <strong>{t.title}</strong>
                        <small>{t.routine}</small>
                      </span>
                    </button>
                    <button
                      className="delete-task"
                      data-task-delete={t.id}
                      aria-label={"Remove " + t.title}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          tasks: s.tasks.filter((item) => item.id !== t.id),
                        }))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!list.length && <p className="empty">No tasks.</p>}
              </section>
            );
          })}
      </div>
      <form
        id="task-form"
        className="add-task"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget),
            title = formText(form, "title").trim();
          if (!title) return;
          update((s) => ({
            ...s,
            tasks: [
              ...s.tasks,
              {
                id: uid(),
                title,
                person: formText(form, "person"),
                routine: formText(form, "routine"),
                done: false,
              },
            ],
          }));
          e.currentTarget.reset();
          notify("Task added.");
        }}
      >
        <label className="task-name">
          Task
          <input
            name="title"
            required
            maxLength={100}
            placeholder="Task name"
            autoComplete="off"
          />
        </label>
        <label>
          For
          <select
            name="person"
            defaultValue={taskPerson === "all" ? "alex" : taskPerson}
            key={taskPerson}
          >
            <PeopleOptions all={false} />
          </select>
        </label>
        <label>
          When
          <select
            name="routine"
            defaultValue={routine === "All" ? "Morning" : routine}
            key={routine}
          >
            <Options values={routines} />
          </select>
        </label>
        <button className="solid" type="submit">
          Add task
        </button>
      </form>
    </section>
  );
}
function WorkCard({ event, open }: { event: WorkEvent; open: OpenWork }) {
  return (
    <button
      className="event-card compact"
      data-work-event={event.id}
      style={personStyle("var(--accent)")}
      onClick={() => open([event], "Meeting details")}
    >
      <span className="event-time">{workTime(event)}</span>
      <strong>{event.title}</strong>
    </button>
  );
}
function Calendar({
  base,
  calendar,
  date,
  setDate,
  mode,
  setMode,
  connect,
  open,
}: {
  base: string;
  calendar: ReturnType<typeof useCalendar>;
  date: string;
  setDate: (date: string) => void;
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  connect: () => void;
  open: OpenWork;
}) {
  const [from] = calendarRange(date, mode);
  const eventsOn = (day: string) =>
    calendar.events.filter((event) => eventOnDay(event, day, TIME_ZONE));
  const ready = calendar.status?.available && !calendar.error;
  const heading =
    mode === "month"
      ? dayLabel(date, { month: "long", year: "numeric" })
      : mode === "week"
        ? dayLabel(from, { month: "short", day: "numeric" }) +
          " – " +
          dayLabel(shiftDay(from, 6), { month: "short", day: "numeric" })
        : dayLabel(date);
  function selectDay(day: string) {
    setDate(day);
    setMode("day");
  }
  function step(direction: number) {
    if (mode !== "month")
      return setDate(shiftDay(date, direction * (mode === "week" ? 7 : 1)));
    const value = new Date(date.slice(0, 7) + "-01T12:00:00");
    value.setMonth(value.getMonth() + direction);
    setDate(
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`,
    );
  }
  function dayEvents(day: string, limit: number) {
    const events = eventsOn(day);
    return (
      <>
        {events.slice(0, limit).map((event) => (
          <WorkCard key={event.id} event={event} open={open} />
        ))}
        {events.length > limit && (
          <button
            className="more-events"
            data-work-day={day}
            onClick={() => open(events, dayLabel(day))}
          >
            +{events.length - limit} more
          </button>
        )}
      </>
    );
  }
  const limit = Math.max(2, Math.min(6, Math.floor((innerHeight - 380) / 94)));
  const events = eventsOn(date);
  return (
    <section className="screen calendar-screen">
      <div className="calendar-toolbar">
        <div className="calendar-date-nav">
          <button
            data-calendar-step="-1"
            aria-label="Previous period"
            onClick={() => step(-1)}
          >
            ←
          </button>
          <h2>{heading}</h2>
          <button
            data-calendar-step="1"
            aria-label="Next period"
            onClick={() => step(1)}
          >
            →
          </button>
          <button
            className="text-button"
            data-calendar-today
            onClick={() => setDate(todayKey())}
          >
            Today
          </button>
        </div>
        <button className="text-button" id="work-connect" onClick={connect}>
          {base ? "Connection settings" : "Connect Mac"}
        </button>
        <div className="routine-tabs" aria-label="Calendar view">
          {calendarModes.map((m) => (
            <button
              key={m}
              data-calendar-mode={m}
              aria-pressed={m === mode}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {!ready && (
        <p className="calendar-message" role="status">
          {calendar.error ||
            (!base
              ? "Connect your Mac to see your work calendar."
              : (calendar.status?.available === false
                  ? calendar.status.unavailableReason
                  : "") || "Loading work calendar…")}
        </p>
      )}
      <div className="calendar-content" data-mode={mode}>
        {ready &&
          (mode === "day" ? (
            <div className="work-day-grid">
              {events.slice(0, events.length > 9 ? 8 : 9).map((event) => (
                <WorkCard key={event.id} event={event} open={open} />
              ))}
              {!events.length && <p className="empty">No work events.</p>}
              {events.length > 9 && (
                <button
                  className="more-events"
                  data-work-day={date}
                  onClick={() => open(events, dayLabel(date))}
                >
                  View all {events.length} events
                </button>
              )}
            </div>
          ) : mode === "week" ? (
            <div className="week-grid">
              {Array.from({ length: 7 }, (_, i) => {
                const day = shiftDay(from, i);
                return (
                  <section
                    key={day}
                    className={
                      "week-day" + (day === todayKey() ? " today" : "")
                    }
                  >
                    <button
                      className="day-heading"
                      data-day={day}
                      onClick={() => selectDay(day)}
                    >
                      <span>{dayLabel(day, { weekday: "short" })}</span>
                      <strong>{Number(day.slice(-2))}</strong>
                    </button>
                    {dayEvents(day, limit)}
                    {!eventsOn(day).length && (
                      <p className="empty">No events.</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              <div className="month-weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="month-grid">
                {Array.from({ length: 42 }, (_, i) => {
                  const day = shiftDay(from, i);
                  return (
                    <section
                      key={day}
                      className={
                        "month-day" +
                        (day.slice(0, 7) !== date.slice(0, 7)
                          ? " outside"
                          : "") +
                        (day === todayKey() ? " today" : "")
                      }
                    >
                      <button
                        className="month-date"
                        data-day={day}
                        onClick={() => selectDay(day)}
                      >
                        {Number(day.slice(-2))}
                      </button>
                      {dayEvents(day, 1)}
                    </section>
                  );
                })}
              </div>
            </>
          ))}
      </div>
    </section>
  );
}
function EventEditor({
  event,
  close,
  update,
  notify,
}: {
  event: HouseholdEvent;
  close: () => void;
  update: Update;
  notify: Notify;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog id="event-dialog" title="Edit event" close={close}>
      <form
        id="event-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const value: HouseholdEvent = {
            id: event.id,
            title: formText(form, "title").trim(),
            date: formText(form, "date"),
            start: formText(form, "start"),
            end: formText(form, "end"),
            person: formText(form, "person"),
            location: formText(form, "location"),
          };
          if (value.end <= value.start)
            return setError("Choose an end time after the start.");
          if (!value.title) return;
          update((s) => ({
            ...s,
            events: s.events.map((item) =>
              item.id === event.id ? { ...value, id: event.id } : item,
            ),
          }));
          close();
          notify("Event saved.");
        }}
      >
        <label>
          Title
          <input
            name="title"
            defaultValue={event.title}
            required
            maxLength={100}
          />
        </label>
        <label>
          Day
          <input name="date" type="date" defaultValue={event.date} required />
        </label>
        <div className="form-two">
          <label>
            Starts
            <input
              name="start"
              type="time"
              defaultValue={event.start}
              required
            />
          </label>
          <label>
            Ends
            <input name="end" type="time" defaultValue={event.end} required />
          </label>
        </div>
        <label>
          For
          <select name="person" defaultValue={event.person}>
            <option value="family">Everyone</option>
            <PeopleOptions all={false} />
          </select>
        </label>
        <label>
          Where
          <input
            name="location"
            defaultValue={event.location}
            maxLength={100}
          />
        </label>
        <p id="event-error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            id="delete-event"
            onClick={() => {
              update((s) => ({
                ...s,
                events: s.events.filter((item) => item.id !== event.id),
              }));
              close();
            }}
          >
            Delete event
          </button>
          <button className="solid" type="submit">
            Save event
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function Connection({
  base,
  save,
  close,
}: {
  base: string;
  save: (value: string) => void;
  close: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog id="gateway-dialog" title="Calendar connection" close={close}>
      <form
        id="gateway-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = formText(new FormData(e.currentTarget), "url").trim();
          try {
            if (value) createGateway(value);
            save(value);
            close();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Invalid calendar connection.",
            );
          }
        }}
      >
        <p>Leave empty to disconnect.</p>
        <label>
          CalendarGateway base URL
          <input
            id="gateway-url"
            name="url"
            type="url"
            defaultValue={base}
            placeholder="http://192.168.1.50:8787"
          />
        </label>
        <p id="gateway-error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <button id="gateway-close" type="button" onClick={close}>
            Cancel
          </button>
          <button className="solid" type="submit">
            Save connection
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function App() {
  const [state, setState] = useState(readHousehold);
  const [view, setView] = useState<View>(() => {
    const value = location.hash.slice(1);
    return isView(value) ? value : "home";
  });
  const [base, setBase] = useState(
    () => localStorage.getItem("komorebi-calendar-url") || "",
  );
  const [date, setDate] = useState(todayKey),
    [mode, setMode] = useState<CalendarMode>("week");
  const [taskPerson, setTaskPerson] = useState("all");
  const [dialog, setDialog] = useState<AppDialog | null>(null),
    [toast, setToast] = useState("");
  const [from, to] = calendarRange(date, mode);
  const calendar = useCalendar(base, from, to);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      setToast("Storage is unavailable. Changes will not survive a reload.");
    }
  }, [state]);
  useEffect(() => {
    document.body.classList.toggle("evening", state.evening);
  }, [state.evening]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const change = () => {
      const value = location.hash.slice(1);
      if (isView(value)) setView(value);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(value: View) {
    history.replaceState(null, "", "#" + value);
    setView(value);
  }
  function open(events: WorkEvent[], title: string) {
    setDialog({ kind: "work", events, title });
  }
  return (
    <>
      <aside className="sidebar">
        <nav aria-label="Dashboard screens">
          {views.map((value) => { const Icon = navigationIcons[value]; return (
            <button
              key={value}
              data-view={value}
              aria-current={view === value ? "page" : "false"}
              onClick={() => navigate(value)}
            >
              <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
              <span>{value.charAt(0).toUpperCase() + value.slice(1)}</span>
            </button>
          ); })}
        </nav>
        <div className="sidebar-footer">
          <button
            id="theme"
            aria-pressed={state.evening}
            onClick={() => setState((s) => ({ ...s, evening: !s.evening }))}
          >
            {state.evening ? <Sun size={24} aria-hidden="true" /> : <Moon size={24} aria-hidden="true" />}
            <span>{state.evening ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>
      <main id="content">
        {view === "home" && (
          <Home
            state={state}
            update={setState}
            navigate={navigate}
            openEvent={(event) => setDialog({ kind: "event", event })}
            showPerson={(id) => {
              setTaskPerson(id);
              navigate("tasks");
            }}
          />
        )}
        {view === "shopping" && (
          <Shopping state={state} update={setState} notify={setToast} />
        )}
        {view === "tasks" && (
          <Tasks
            state={state}
            update={setState}
            notify={setToast}
            taskPerson={taskPerson}
            setTaskPerson={setTaskPerson}
          />
        )}
        {view === "calendar" && (
          <Calendar
            base={base}
            calendar={calendar}
            date={date}
            setDate={setDate}
            mode={mode}
            setMode={setMode}
            connect={() => setDialog({ kind: "connection" })}
            open={open}
          />
        )}
      </main>
      <div
        id="toast"
        role="status"
        aria-live="polite"
        className={toast ? "visible" : ""}
      >
        {toast}
      </div>
      {dialog?.kind === "event" && (
        <EventEditor
          event={dialog.event}
          close={() => setDialog(null)}
          update={setState}
          notify={setToast}
        />
      )}
      {dialog?.kind === "connection" && (
        <Connection
          base={base}
          save={(value) => {
            localStorage.setItem("komorebi-calendar-url", value);
            setBase(value);
          }}
          close={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "work" && (
        <Dialog
          id="work-dialog"
          title={dialog.title}
          close={() => setDialog(null)}
        >
          <div id="work-dialog-content">
            {dialog.events.map((event) => (
              <article key={event.id} className="work-detail">
                <p>
                  {workTime(event)}
                  {!event.isAllDay &&
                    " – " +
                      new Date(event.end).toLocaleTimeString("en-US", {
                        timeZone: TIME_ZONE,
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                </p>
                <h3>{event.title}</h3>
                {event.location && <p>{event.location}</p>}
              </article>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing dashboard root.");
createRoot(root).render(<App />);
