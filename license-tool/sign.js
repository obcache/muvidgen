#!/usr/bin/env node
/**
 * Offline signer for muvid licenses.
 *
 * Usage:
 *   node sign.js --hwid <fingerprint> --name "Customer Name" --days 365
 *   node sign.js --hwid <fingerprint> --name "Customer Name" --perpetual
 *
 * Requires a private key at ./keys/private.pem (generate with generate-keys.js).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
};
const hasFlag = (flag) => args.includes(flag);

const hwid = getArg('--hwid');
const name = getArg('--name') || 'User';
const days = getArg('--days');
const perpetual = hasFlag('--perpetual');

if (!hwid) {
  console.error('Missing required --hwid');
  process.exit(1);
}

const keyPath = path.join(process.cwd(), 'license-tool', 'keys', 'private.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`Private key not found at ${keyPath}. Run "npm run genkeys" first.`);
  process.exit(1);
}

const privKey = fs.readFileSync(keyPath, 'utf-8');

const header = { alg: 'RS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: 'muvid-offline-signer',
  sub: name,
  hwid,
  iat: now,
  plan: perpetual ? 'perpetual' : 'term',
};
if (!perpetual) {
  const d = Number(days ?? 365);
  payload.exp = now + Math.max(1, d) * 24 * 60 * 60;
}

const b64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privKey);
const token = `${signingInput}.${b64url(signature)}`;

console.log(token);

