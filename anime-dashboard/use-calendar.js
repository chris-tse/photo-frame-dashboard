import { useEffect, useState } from "react";
import { createGateway } from "./calendar-gateway.js";

// Status polling is independent of date navigation, which only fetches events.
export function useCalendar(base, from, to) {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState("");
  useEffect(() => {
    let canceled = false,
      timer,
      failures = 0;
    setStatus(null);
    setStatusError("");
    if (!base) return;
    async function poll() {
      let delay = 30000;
      try {
        const result = await createGateway(base).status();
        if (canceled) return;
        setStatus(result);
        setStatusError("");
        failures = 0;
      } catch (error) {
        if (canceled) return;
        setStatusError(error.message);
        delay = Math.max(
          error.retryAfter || 30000,
          Math.min(300000, 30000 * 2 ** Math.min(failures++, 4)),
        );
      }
      if (!canceled) timer = setTimeout(poll, delay);
    }
    poll();
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [base]);
  useEffect(() => {
    let canceled = false,
      timer,
      failures = 0;
    setEvents([]);
    setEventsError("");
    if (!base || !status?.available) return;
    async function load() {
      try {
        const result = await createGateway(base).events(from, to);
        if (!canceled) {
          setEvents(result);
          setEventsError("");
          failures = 0;
          timer = setTimeout(load, 30000);
        }
      } catch (error) {
        if (canceled) return;
        setEventsError(error.message);
        timer = setTimeout(
          load,
          Math.max(
            error.retryAfter || 30000,
            Math.min(300000, 30000 * 2 ** Math.min(failures++, 4)),
          ),
        );
      }
    }
    load();
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [base, from, to, status?.available]);
  return { status, events, error: statusError || eventsError };
}
