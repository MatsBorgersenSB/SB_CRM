import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "enc:v1:";

/**
 * Derive a 32-byte AES key from TOKEN_ENCRYPTION_SECRET.
 * Dev fallback: deterministic SHA-256 of a local-only salt (never use in production).
 */
function resolveEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();
  if (secret) {
    return createHash("sha256").update(secret, "utf8").digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TOKEN_ENCRYPTION_SECRET must be set in production to encrypt OAuth tokens at rest",
    );
  }

  // Secure 32-byte key material for local/dev only.
  return createHash("sha256")
    .update("smartcrm-dev-token-encryption-fallback-v1", "utf8")
    .digest();
}

function isEncryptedPayload(value: string): boolean {
  return value.startsWith(VERSION_PREFIX);
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Output format: enc:v1:<iv_b64url>:<tag_b64url>:<ciphertext_b64url>
 */
export function encryptToken(text: string): string {
  if (!text) return text;
  if (isEncryptedPayload(text)) return text;

  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "enc:v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/**
 * Decrypt AES-256-GCM ciphertext produced by encryptToken.
 * Plaintext legacy values (pre-encryption) are returned unchanged.
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText) return cipherText;
  if (!isEncryptedPayload(cipherText)) {
    return cipherText;
  }

  const parts = cipherText.split(":");
  // enc : v1 : iv : tag : ciphertext
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Invalid encrypted token format");
  }

  const [, , ivB64, tagB64, dataB64] = parts;
  const key = resolveEncryptionKey();
  const iv = Buffer.from(ivB64!, "base64url");
  const tag = Buffer.from(tagB64!, "base64url");
  const data = Buffer.from(dataB64!, "base64url");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isTokenEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && isEncryptedPayload(value));
}
