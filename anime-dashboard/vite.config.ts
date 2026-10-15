import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { target: "chrome106", cssTarget: "chrome61" },
});
