# Frame performance

The target FRAME157 has a slow, older Rockchip RK3326 CPU, 1 GB of RAM, and a Chrome 106 Android WebView. Treat these as baseline constraints for dashboard changes.

- Be aggressive about performance: minimize main-thread work, unnecessary React renders, DOM size, image decoding costs, and retained memory.
- Keep dependencies lean, size images for the display, and clean up timers, listeners, and requests when their owners unmount.
- Preserve Chrome 106 compatibility. Build targets handle syntax; check browser API and CSS support separately.
- Verify performance-sensitive changes on the actual frame. Use measured responsiveness and memory usage to guide optimizations; bundle size alone is insufficient.

# Running and updating the frame

Before running, deploying, or verifying dashboard changes, read [anime-dashboard/README.md](anime-dashboard/README.md). It covers the local server, frame reload, calendar tunnel, and verification commands.
