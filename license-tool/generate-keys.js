#!/usr/bin/env node
/**
 * Generate an RSA keypair for offline signing.
 * Keys are written to ./license-tool/keys/private.pem and public.pem
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const keysDir = path.join(process.cwd(), 'license-tool', 'keys');
fs.mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

console.log('Generated keys in license-tool/keys');
