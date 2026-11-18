import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb, migrate } from "./db.js";

const db = await createDb();
const applied = await migrate(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);
if (!process.env.DATABASE_URL) console.log("No DATABASE_URL set: using embedded PGlite in .data/pglite");

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: createApp(db).fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Still Growing API listening on http://localhost:${info.port}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await db.close();
    process.exit(0);
  });
}
