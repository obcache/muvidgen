# MuvidGen License Tool (Offline signer)

Dev-only helper to mint offline license tokens. Not used in the app build.

## Setup
```sh
cd license-tool
npm install   # nothing to install, but keeps npm happy
npm run genkeys   # generates ./keys/private.pem and public.pem
```

Replace the generated keys with your production keys when ready.

## Generate a token
```sh
# Perpetual
node sign.js --hwid <machine-fingerprint> --name "Customer Name" --perpetual

# Term (365 days)
node sign.js --hwid <machine-fingerprint> --name "Customer Name" --days 365
```

The tool expects a private key at `./keys/private.pem`. It outputs a signed JWT (RS256).

## Notes
- Keep `keys/private.pem` secret. Do **not** ship it with the app.
- The app should embed the matching public key to verify tokens offline.
- Hardware fingerprint (`hwid`) must match whatever the app reports for that machine.
