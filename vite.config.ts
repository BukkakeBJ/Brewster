import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { include: ["tests/**/[!._]*.test.ts"] },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:3001" },
    watch: { ignored: ["**/.runtime/**", "**/dist/**"] },
  },
});
