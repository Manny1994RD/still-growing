/**
 * Server-owner tool: set a user's password directly.
 *   docker compose exec api node dist/cli/set-password.js someone@example.com NewPassword123
 */
import { hashPassword } from "../auth.js";
import { createDb, migrate } from "../db.js";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("Usage: set-password <email> <new password (8+ characters)>");
  process.exit(1);
}
const db = await createDb();
await migrate(db);
const rows = await db.query(`UPDATE users SET password_hash = $2 WHERE email = $1 RETURNING id`, [
  email.toLowerCase(),
  await hashPassword(password),
]);
console.log(rows.length ? `Password updated for ${email}` : `No account found for ${email}`);
await db.close();
