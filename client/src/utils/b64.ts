const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
};

export const base64UrlEncode = (input: Uint8Array | string) => {
  const buf = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return toBase64(buf).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

export const base64UrlDecode = (b64url: string): Uint8Array => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  return fromBase64(b64);
};
