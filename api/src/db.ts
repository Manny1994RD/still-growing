import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Minimal database interface shared by Postgres (production / Docker)
 * and PGlite (embedded Postgres used for local dev and tests when no
 * DATABASE_URL is set).
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  close(): Promise<void>;
}

export async function createDb(url = process.env.DATABASE_URL): Promise<Db> {
  if (url && url.startsWith("postgres")) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 10, onnotice: () => {} });
    return {
      query: async <T>(text: string, params: unknown[] = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as T[],
      exec: async (text) => {
        await sql.unsafe(text);
      },
      close: () => sql.end(),
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  let dataDir: string | undefined;
  if (url !== "memory://") {
    dataDir = path.resolve(process.env.PGLITE_DIR ?? ".data/pglite");
    await mkdir(dataDir, { recursive: true });
  }
  const pg = new PGlite(dataDir);
  return {
    query: async <T>(text: string, params: unknown[] = []) =>
      (await pg.query<T>(text, params)).rows,
    exec: async (text) => {
      await pg.exec(text);
    },
    close: () => pg.close(),
  };
}

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

/** Applies every migrations/*.sql file not yet recorded, in filename order. */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const done = new Set(
    (await db.query<{ name: string }>(`SELECT name FROM schema_migrations`)).map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
    await db.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    applied.push(file);
  }
  return applied;
}
