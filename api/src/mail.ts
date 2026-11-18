import nodemailer from "nodemailer";

/**
 * Sends email when SMTP_URL is configured (e.g. smtps://user:app-password@smtp.gmail.com:465).
 * Without it, the message is written to the server log so the server owner can
 * read the reset code with `docker compose logs api` and pass it on.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<"sent" | "logged"> {
  const url = process.env.SMTP_URL;
  if (!url) {
    console.log(`[mail] To: ${to} | ${subject}\n${text}`);
    return "logged";
  }
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({ from: process.env.SMTP_FROM ?? "Still Growing <no-reply@localhost>", to, subject, text });
  return "sent";
}
