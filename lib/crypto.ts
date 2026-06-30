// AES-256-GCM authenticated encryption for connector credentials.
// Server-side only. Never import from a client component.
//
// Storage format: "<iv_b64>:<tag_b64>:<ciphertext_b64>"
// A fresh random IV is generated per encryption — identical plaintexts
// produce different ciphertexts, leaking no information about reuse.

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce (GCM recommendation)
const KEY_BYTES = 32; // 256-bit key

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY is not configured");
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars). ` +
        `Got ${key.length} bytes.`
    );
  }
  return key;
}

export function encryptCredential(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

export function decryptCredential(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted credential format");
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Returns "••••••••" + last 4 chars, or "••••" for short secrets.
// Called on the plaintext at save-time; only the masked string reaches the client.
export function maskCredential(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return "••••••••" + plaintext.slice(-4);
}
