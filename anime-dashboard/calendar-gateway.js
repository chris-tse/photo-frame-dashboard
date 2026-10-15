// Calendar data stays in memory. No tokens, persistence, or request logging.
export class GatewayError extends Error {
  constructor(code, message, retryAfter = 0) { super(message); this.code = code; this.retryAfter = retryAfter; }
}
export function retryDelay(value, now = Date.now()) {
  if (!value) return 30000;
  const seconds = Number(value);
  return Math.max(30000, Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(value) - now) || 30000);
}
export function eventOnDay(event, day, timeZone) {
  if (event.isAllDay) return event.startDate <= day && day < event.endDate;
  const key = value => new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(value)).filter(p => ['year','month','day'].includes(p.type)).reduce((parts,p) => ({...parts,[p.type]:p.value}), {});
  const date = value => { const p=key(value); return `${p.year}-${p.month}-${p.day}`; };
  return date(event.start) <= day && date(new Date(Date.parse(event.end)-1)) >= day;
}
export function createGateway(base, fetcher = fetch) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP or HTTPS base URL without credentials or query parameters.');
  async function get(path, params) {
    const target = new URL(url.href.replace(/\/$/, '') + '/api/v1/' + path);
    if (params) target.search = new URLSearchParams(params).toString();
    let response;
    try { response = await fetcher(target, {method:'GET', credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(15000)}); }
    catch { throw new GatewayError('connection_failed', 'Cannot reach CalendarGateway. Check the Mac address, network and allowed CORS origin.'); }
    let body;
    try { body = await response.json(); } catch { throw new GatewayError('invalid_response', 'CalendarGateway returned an unreadable response.'); }
    if (!response.ok) throw new GatewayError(body.error?.code || 'request_failed', body.error?.message || 'CalendarGateway request failed.', retryDelay(response.headers.get('Retry-After')));
    return body;
  }
  return {
    status: () => get('status'),
    async events(from, to) {
      const events=[];
      for (let offset=0;;) {
        const page = await get('events', {from,to,limit:'500',offset:String(offset),includeAllDay:'true',includeDeclined:'false',includeCanceled:'false',sort:'asc'});
        if (!Array.isArray(page.events)) throw new GatewayError('invalid_response','CalendarGateway returned an invalid event list.');
        events.push(...page.events);
        if (!page.hasMore) return events;
        if (!page.events.length) throw new GatewayError('invalid_response','CalendarGateway returned an empty page with more events pending.');
        offset += page.events.length;
      }
    }
  };
}
