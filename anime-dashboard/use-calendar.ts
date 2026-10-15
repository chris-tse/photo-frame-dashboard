import type { GatewayStatus, WorkEvent } from "./models.ts";
import { useEffect, useState } from "react";
import { createGateway, gatewayFailure } from "./calendar-gateway.ts";

// Status polling is independent of date navigation, which only fetches events.
export function useCalendar(base: string, from: string, to: string) {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [events, setEvents] = useState<WorkEvent[]>([]);
  const [eventsError, setEventsError] = useState("");
  useEffect(() => {
    let canceled = false,
      timer: ReturnType<typeof setTimeout> | undefined,
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
      } catch (caught) {
        const error = gatewayFailure(caught);
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
      timer: ReturnType<typeof setTimeout> | undefined,
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
      } catch (caught) {
        const error = gatewayFailure(caught);
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
