import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64urlnopad } from '@scure/base';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

/**
 * The share envelope is the string after `#` in a receive link, or on its own in a content QR code.
 * It is a query string with two parameters; `alg` takes JOSE (RFC 7518) algorithm names:
 *
 *   data=<base64url(body)>                                           plain
 *   alg=A256GCM&data=<base64url(nonce | ciphertext)>                 AES-256-GCM with a shared random key
 *   alg=ECDH-ES&data=<base64url(ephemeral key | nonce | ciphertext)> to a recipient's X25519 public key
 *
 * `ECDH-ES` always means X25519 agreement with a fresh ephemeral key per message, HKDF-SHA256 over the
 * shared secret salted with both public keys, then AES-256-GCM. In both encrypted forms the `alg` value is the AAD.
 * `body` starts with one flag byte: 0 for raw UTF-8, 1 for deflate-raw UTF-8.
 *
 * Keys are plain Base64URL without padding, as in JWK, with no marker of their own:
 * what a key is for follows from where it is entered.
 *
 * The format is a public contract: links already sent must keep decoding the same way,
 * so a new kind of encryption gets a new `alg` value instead of changing an existing one.
 */

export const ALG_KEY = 'A256GCM';
export const ALG_PUBLIC = 'ECDH-ES';

/** HKDF domain separation; part of the format, so it never changes. */
const PUBLIC_INFO = strToU8('share/public-key');

const FLAG_RAW = 0;
const FLAG_DEFLATE = 1;

const KEY_BYTES = 32;
const NONCE_BYTES = 12;

export type EnvelopeErrorCode = 'format' | 'key' | 'decrypt';

export class EnvelopeError extends Error {
  readonly code: EnvelopeErrorCode;

  constructor(code: EnvelopeErrorCode, message: string) {
    super(message);
    this.name = 'EnvelopeError';
    this.code = code;
  }
}

/** `key`: sealed with a shared random key; `public`: sealed to a public key, opened with its private key. */
export type Scheme = 'key' | 'public';

export type ParsedEnvelope = { encrypted: false; text: string } | { encrypted: true; scheme: Scheme; data: Uint8Array };

function pack(text: string): Uint8Array {
  const raw = strToU8(text);
  const deflated = deflateSync(raw, { level: 9 });
  const [flag, body] = deflated.length < raw.length ? [FLAG_DEFLATE, deflated] : [FLAG_RAW, raw];
  const out = new Uint8Array(body.length + 1);
  out[0] = flag;
  out.set(body, 1);
  return out;
}

function unpack(bytes: Uint8Array): string {
  const body = bytes.subarray(1);
  try {
    switch (bytes[0]) {
      case FLAG_RAW:
        return strFromU8(body);
      case FLAG_DEFLATE:
        return strFromU8(inflateSync(body));
    }
  } catch {
    // Falls through to the format error below.
  }
  throw new EnvelopeError('format', '内容已损坏，无法解码');
}

function decodeBase64url(text: string): Uint8Array {
  try {
    return base64urlnopad.decode(text);
  } catch {
    throw new EnvelopeError('format', '内容不是有效的 Base64URL 编码');
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function envelope(alg: string | null, data: Uint8Array): string {
  const encoded = `data=${base64urlnopad.encode(data)}`;
  return alg === null ? encoded : `alg=${alg}&${encoded}`;
}

/** Decodes 32 bytes of Base64URL key material, naming it `what` (密钥, 公钥 or 私钥) in errors. */
function decodeKeyBytes(text: string, what: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = base64urlnopad.decode(text.trim());
  } catch {
    throw new EnvelopeError('key', `${what}格式不正确`);
  }
  if (bytes.length !== KEY_BYTES) {
    throw new EnvelopeError('key', `${what}长度不正确`);
  }
  return bytes;
}

/** Whether `text` has the shape of a key: Base64URL that decodes to 256 bits. */
export function isKey(text: string): boolean {
  try {
    decodeKeyBytes(text, '密钥');
    return true;
  } catch {
    return false;
  }
}

/** X25519 public and private keys look exactly like random keys; this name only says where one is expected. */
export const isX25519Key = isKey;

/** Generates a random 256-bit key, encoded as 43 Base64URL characters. */
export function generateKey(): string {
  return base64urlnopad.encode(randomBytes(KEY_BYTES));
}

/** Whether `text` reads as an envelope: a query string with a `data` parameter. */
export function looksLikeEnvelope(text: string): boolean {
  return /(?:^|&)data=/.test(text.trim());
}

export function encodePlain(text: string): string {
  return envelope(null, pack(text));
}

export function encodeEncrypted(text: string, key: string): string {
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = gcm(decodeKeyBytes(key, '密钥'), nonce, strToU8(ALG_KEY)).encrypt(pack(text));
  return envelope(ALG_KEY, concat(nonce, sealed));
}

/** Parses an envelope; encrypted data still needs {@link decrypt} or {@link decryptWithPrivateKey}. */
export function parseEnvelope(text: string): ParsedEnvelope {
  const params = new URLSearchParams(text.trim());
  const data = params.get('data');
  if (data === null || data === '') {
    throw new EnvelopeError('format', '链接内容不完整，可能在复制或传输时被截断');
  }
  const alg = params.get('alg');
  switch (alg) {
    case null:
      return { encrypted: false, text: unpack(decodeBase64url(data)) };
    case ALG_KEY:
      return { encrypted: true, scheme: 'key', data: decodeBase64url(data) };
    case ALG_PUBLIC:
      return { encrypted: true, scheme: 'public', data: decodeBase64url(data) };
    default:
      throw new EnvelopeError('format', `不支持的加密方式：${alg}`);
  }
}

export function decrypt(data: Uint8Array, key: string): string {
  const keyBytes = decodeKeyBytes(key, '密钥');
  if (data.length <= NONCE_BYTES) {
    throw new EnvelopeError('format', '密文不完整');
  }
  let packed: Uint8Array;
  try {
    const nonce = data.subarray(0, NONCE_BYTES);
    packed = gcm(keyBytes, nonce, strToU8(ALG_KEY)).decrypt(data.subarray(NONCE_BYTES));
  } catch {
    throw new EnvelopeError('decrypt', '解密失败：密钥不匹配，或链接内容被改动');
  }
  return unpack(packed);
}

/** A key pair for receiving by public key. The private key is kept as bytes and exported only on request. */
export interface KeyPair {
  publicKey: string;
  privateKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  const { secretKey, publicKey } = x25519.keygen();
  return { publicKey: base64urlnopad.encode(publicKey), privateKey: secretKey };
}

/** The private key as text, for the owner's own backup. */
export function exportPrivateKey(privateKey: Uint8Array): string {
  return base64urlnopad.encode(privateKey);
}

/** Restores a key pair from a backed-up private key; the public key follows from it. */
export function importPrivateKey(text: string): KeyPair {
  const privateKey = decodeKeyBytes(text, '私钥');
  return { publicKey: base64urlnopad.encode(x25519.getPublicKey(privateKey)), privateKey };
}

function derivePublicKey(shared: Uint8Array, ephemeral: Uint8Array, recipient: Uint8Array): Uint8Array {
  return hkdf(sha256, shared, concat(ephemeral, recipient), PUBLIC_INFO, KEY_BYTES);
}

/** Seals `text` so that only the holder of the private key behind `publicKey` can open it. */
export function encodeSealedFor(text: string, publicKey: string): string {
  const recipient = decodeKeyBytes(publicKey, '公钥');
  const ephemeral = x25519.keygen();
  let shared: Uint8Array;
  try {
    shared = x25519.getSharedSecret(ephemeral.secretKey, recipient);
  } catch {
    // X25519 rejects low-order points, which a malformed public key can be.
    throw new EnvelopeError('key', '公钥无效');
  }
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = gcm(derivePublicKey(shared, ephemeral.publicKey, recipient), nonce, strToU8(ALG_PUBLIC)).encrypt(
    pack(text)
  );
  return envelope(ALG_PUBLIC, concat(ephemeral.publicKey, nonce, sealed));
}

export function decryptWithPrivateKey(data: Uint8Array, privateKey: Uint8Array): string {
  if (data.length <= KEY_BYTES + NONCE_BYTES) {
    throw new EnvelopeError('format', '密文不完整');
  }
  const ephemeral = data.subarray(0, KEY_BYTES);
  const nonce = data.subarray(KEY_BYTES, KEY_BYTES + NONCE_BYTES);
  let packed: Uint8Array;
  try {
    const shared = x25519.getSharedSecret(privateKey, ephemeral);
    const key = derivePublicKey(shared, ephemeral, x25519.getPublicKey(privateKey));
    packed = gcm(key, nonce, strToU8(ALG_PUBLIC)).decrypt(data.subarray(KEY_BYTES + NONCE_BYTES));
  } catch {
    throw new EnvelopeError('decrypt', '解密失败：这条内容不是用本页的公钥加密的，或内容被改动');
  }
  return unpack(packed);
}
