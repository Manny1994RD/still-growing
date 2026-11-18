import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 11);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
