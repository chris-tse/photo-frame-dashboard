import { parseStatus, parseWorkEvent, record, string } from "./models.ts";
import type { WorkEvent } from "./models.ts";
// Calendar data stays in memory. No tokens, persistence, or request logging.
export class GatewayError extends Error {
  readonly code: string;
  readonly retryAfter: number;
  constructor(code: string, message: string, retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
export function retryDelay(value: string | null, now = Date.now()) {
  if (!value) return 30000;
  const seconds = Number(value);
  return Math.max(
    30000,
    Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(value) - now || 30000,
  );
}
export function eventOnDay(event: WorkEvent, day: string, timeZone: string) {
  if (event.isAllDay) return event.startDate <= day && day < event.endDate;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const date = (value: string | number) => {
    const parts = formatter.formatToParts(new Date(value));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  return date(event.start) <= day && date(Date.parse(event.end) - 1) >= day;
}
export function createGateway(base: string, fetcher: typeof fetch = fetch) {
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTP or HTTPS base URL without credentials or query parameters.",
    );
  async function get(
    path: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const target = new URL(url.href.replace(/\/$/, "") + "/api/v1/" + path);
    if (params) target.search = new URLSearchParams(params).toString();
    let response: Response;
    try {
      response = await fetcher(target, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new GatewayError(
        "connection_failed",
        "Cannot reach CalendarGateway. Check the Mac address, network and allowed CORS origin.",
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new GatewayError(
        "invalid_response",
        "CalendarGateway returned an unreadable response.",
      );
    }
    if (!response.ok) {
      let code = "request_failed",
        message = "CalendarGateway request failed.";
      try {
        const error = record(record(body).error);
        code = string(error.code);
        message = string(error.message);
      } catch {}
      throw new GatewayError(
        code,
        message,
        retryDelay(response.headers.get("Retry-After")),
      );
    }
    return body;
  }
  return {
    async status() {
      const body = await get("status");
      try {
        return parseStatus(body);
      } catch {
        throw new GatewayError(
          "invalid_response",
          "CalendarGateway returned an invalid status.",
        );
      }
    },
    async events(from: string, to: string): Promise<WorkEvent[]> {
      const events: WorkEvent[] = [];
      for (let offset = 0; ;) {
        const body = await get("events", {
          from,
          to,
          limit: "500",
          offset: String(offset),
          includeAllDay: "true",
          includeDeclined: "false",
          includeCanceled: "false",
          sort: "asc",
        });
        let page: { events: WorkEvent[]; hasMore: boolean };
        try {
          const source = record(body);
          if (
            !Array.isArray(source.events) ||
            typeof source.hasMore !== "boolean"
          )
            throw new Error("Invalid page.");
          page = {
            events: source.events.map(parseWorkEvent),
            hasMore: source.hasMore,
          };
        } catch {
          throw new GatewayError(
            "invalid_response",
            "CalendarGateway returned an invalid event list.",
          );
        }
        events.push(...page.events);
        if (!page.hasMore) return events;
        if (!page.events.length)
          throw new GatewayError(
            "invalid_response",
            "CalendarGateway returned an empty page with more events pending.",
          );
        offset += page.events.length;
      }
    },
  };
}
export function gatewayFailure(error: unknown) {
  return error instanceof GatewayError
    ? error
    : new GatewayError(
        "unexpected_error",
        error instanceof Error
          ? error.message
          : "CalendarGateway request failed.",
      );
}
