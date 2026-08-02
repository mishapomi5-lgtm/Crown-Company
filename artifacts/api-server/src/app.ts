import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";
// Initialize SQLite database on startup (creates tables + seeds partners)
import "./lib/database";
import { initBackupScheduler } from "./routes/backup";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Start auto-backup scheduler (reads persisted settings)
initBackupScheduler();

// ── Electron production: serve the built React frontend ────────────────────
// When ELECTRON_STATIC_DIR is set (by the Electron main process), Express
// also serves the compiled frontend so the Electron window can load
// http://localhost:<PORT>/ and reach both the API and the SPA from one origin.
// This has no effect in normal dev/browser mode.
const electronStaticDir = process.env.ELECTRON_STATIC_DIR;
if (electronStaticDir) {
  const staticRoot = path.resolve(electronStaticDir);
  app.use(express.static(staticRoot));
  // SPA fallback: any unmatched route returns index.html for client-side routing.
  app.use((_req, res) => {
    res.sendFile(path.join(staticRoot, "index.html"));
  });
  logger.info({ staticRoot }, "Serving frontend static files (Electron production mode)");
}

export default app;
