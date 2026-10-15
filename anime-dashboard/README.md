# Komorebi dashboard

An independent household dashboard with Home, Shopping, Tasks and Calendar screens. Built with React, TypeScript and Vite. Written from scratch; the repository demo informed the kinds of interactions only. The original dashboard is unchanged.

Shopping, tasks, household events and notes are saved in this browser's local storage. Household data starts with fictional examples. Work-calendar events are read-only and kept in memory, separate from editable household plans.

## Run locally

From the repository root:

```sh
npm --prefix anime-dashboard ci
npm --prefix anime-dashboard run build
./scripts/start-anime-dashboard.sh
```

The script reports the LAN URL. It serves only `anime-dashboard/dist` through a temporary user service, `photo-frame-anime-dashboard.service`. Rebuilding updates the served files; reload the dashboard afterward. The computer must remain awake and connected. The temporary service does not automatically start after a reboot.

```sh
./scripts/stop-anime-dashboard.sh
```

## Update the frame

The frame loads the dashboard from the Linux server; files are not copied to Android. Run these commands from the repository root after editing:

```sh
npm --prefix anime-dashboard run build
./scripts/start-anime-dashboard.sh
```

Tap the refresh icon at the bottom of the sidebar to load the new build. With its USB data cable connected and ADB authorized, restart Home HQ:

```sh
adb devices -l
adb -d shell am force-stop com.wesbos.homehq
adb -d shell am start -n com.wesbos.homehq/.MainActivity
```

Use an installed `adb`, or the local binary at `diagnostics/pastigio-frame157/tools/adb` if available. Home HQ retains its startup URL, currently `http://192.168.1.119:5180/`. Keep the host on that address and port to preserve the existing frame URL and firewall rule. A Git push alone does not update the running dashboard.

For temporary WebView inspection, start the activity with `--ez debug true`. After inspection, start it again without that extra to disable debugging, and remove any ADB port forwards you created. Keep corporate calendar details out of screenshots and logs.

## CalendarGateway

Open Calendar, then Connection settings. Use the dashboard server’s `/calendar` URL for the authenticated SSH route below. Direct browser connections require CalendarGateway to allow the dashboard origin and cannot use a private bearer token.

The frame now connects to `http://192.168.1.119:5180/calendar`. The server forwards only GET requests for status and events to `127.0.0.1:18787`, through the SSH tunnel to CalendarGateway on the Mac's localhost. No CalendarGateway CORS change is needed for this route.

Start the temporary tunnel with `./scripts/start-calendar-tunnel.sh`. It mirrors the existing T3 corporate tunnel's key authentication, keepalives and localhost binding, using a separate service and port. Stop it with `systemctl --user stop photo-frame-calendar-tunnel.service`. Both machines must stay awake. No boot startup is enabled.

If authentication is required, store the raw token in `~/.config/photo-frame-dashboard/calendar-token` with mode 600 inside a private directory. The server reads it on each request and adds the Authorization header upstream only. Never put it in dashboard source, local storage, URLs or logs. Work-calendar responses use Cache-Control: no-store.
Status refreshes every 30 seconds. The calendar grid contains work events only. Calendar requests cover the displayed day, Sunday-to-Saturday week or Sunday-first 42-cell month, paginate as necessary, and refresh immediately after navigation without repolling status. Busy days open their full event list in a dialog so the grid fits the frame without scrolling. Failures show unavailable and retry with backoff, honoring Retry-After. All-day end dates are exclusive. Timed events display in America/Chicago. Household demo plans remain separate on Home and do not populate the work-calendar grid.

## Verify

```sh
node scripts/verify-calendar-gateway.mjs
node scripts/verify-calendar-range.mjs
CHROME_PATH=/path/to/chrome node scripts/verify-anime-dashboard.mjs
```

Vite targets Chrome 106 for the frame's WebView. Browser verification uses isolated fictional data. Avoid screenshots or shared browser inspection when real corporate calendar details are visible.

## Photograph

Coastal Enoden train photograph by [Sunil Poudel on Pexels](https://www.pexels.com/photo/train-in-move-near-sea-9496189/), used under the [Pexels license](https://www.pexels.com/license/). The downloaded asset is served locally. No generated illustration assets are used.

## Development and upstream updates

Run `npm --prefix anime-dashboard run typecheck` for strict TypeScript checking. Production builds run this check automatically. Verification scripts that import TypeScript require Node.js 22.18 or newer.

Run `npm --prefix anime-dashboard run dev` for React Fast Refresh. The development server serves the UI; use the existing dashboard server’s absolute `/calendar` URL for calendar requests. Build before reloading the frame. The browser storage keys are preserved across the React migration.

`origin` points to `chris-tse/photo-frame-dashboard`; `upstream` points to `wesbos/photo-frame-dashboard`. To bring upstream changes into your fork:

```sh
git fetch upstream
git merge upstream/main
git push origin main
```
