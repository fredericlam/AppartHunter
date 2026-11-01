import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import path from "node:path";

// Dev-only endpoint: POST /api/refresh runs the Python fetcher, which rewrites public/listings.json.
function refreshApi(): Plugin {
  let running: Promise<{ ok: boolean; log: string }> | null = null;
  const root = path.resolve(__dirname, "..");
  const run = () =>
    new Promise<{ ok: boolean; log: string }>((resolve) => {
      const p = spawn(path.join(root, ".venv/bin/python"), ["run.py"], { cwd: root });
      let log = "";
      p.stdout.on("data", (d) => (log += d));
      p.stderr.on("data", (d) => (log += d));
      p.on("close", (code) => resolve({ ok: code === 0, log: log.slice(-4000) }));
      p.on("error", (e) => resolve({ ok: false, log: String(e) }));
    });
  return {
    name: "refresh-api",
    configureServer(server) {
      server.middlewares.use("/api/refresh", async (req, res) => {
        if (req.method !== "POST") return void (res.statusCode = 405, res.end());
        running ??= run().finally(() => (running = null));
        const result = await running;
        res.setHeader("Content-Type", "application/json");
        res.statusCode = result.ok ? 200 : 500;
        res.end(JSON.stringify(result));
      });

    },
  };
}

export default defineConfig({
  plugins: [react(), refreshApi()],
  server: { port: 5180, open: true },
});
