import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    https: {
      key: "./cert.key",
      cert: "./cert.crt",
    },
  },
});
