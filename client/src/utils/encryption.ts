// Client-side end-to-end encryption using Web Crypto API
// Uses ECDH for key exchange, AES-GCM for message encryption

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;

// ─── Key generation ──────────────────────────────────────────────────────────
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPrivateKey(base64: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// ─── Shared secret derivation ─────────────────────────────────────────────────
export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt message ──────────────────────────────────────────────────────────
export async function encryptMessage(text: string, sharedKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    sharedKey,
    encoded
  );

  // Combine IV + ciphertext, encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

// ─── Decrypt message ──────────────────────────────────────────────────────────
export async function decryptMessage(encryptedBase64: string, sharedKey: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    sharedKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Local key storage ────────────────────────────────────────────────────────
const KEY_STORE_PREFIX = 'e2e_key_';

export function storeKeyPair(userId: string, privateKeyB64: string, publicKeyB64: string): void {
  try {
    sessionStorage.setItem(`${KEY_STORE_PREFIX}${userId}_private`, privateKeyB64);
    sessionStorage.setItem(`${KEY_STORE_PREFIX}${userId}_public`, publicKeyB64);
  } catch {
    console.warn('Could not store encryption keys');
  }
}

export function getStoredPrivateKey(userId: string): string | null {
  return sessionStorage.getItem(`${KEY_STORE_PREFIX}${userId}_private`);
}

export function getStoredPublicKey(userId: string): string | null {
  return sessionStorage.getItem(`${KEY_STORE_PREFIX}${userId}_public`);
}

// ─── Initialize E2E encryption for a user session ────────────────────────────
export async function initE2EEncryption(userId: string): Promise<{ publicKeyB64: string }> {
  let privateKeyB64 = getStoredPrivateKey(userId);
  let publicKeyB64 = getStoredPublicKey(userId);

  if (!privateKeyB64 || !publicKeyB64) {
    const keyPair = await generateKeyPair();
    privateKeyB64 = await exportPrivateKey(keyPair.privateKey);
    publicKeyB64 = await exportPublicKey(keyPair.publicKey);
    storeKeyPair(userId, privateKeyB64, publicKeyB64);
  }

  return { publicKeyB64 };
}
