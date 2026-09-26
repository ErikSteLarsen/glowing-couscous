import { readFile } from 'node:fs/promises';

async function loadEnvFile(path) {
  try {
    const text = await readFile(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await loadEnvFile('.env.local');
await loadEnvFile('.env');

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const callbackUrl = process.env.STRAVA_WEBHOOK_CALLBACK_URL;
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
if (!clientId || !clientSecret || !callbackUrl || !verifyToken) {
  console.error('Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_CALLBACK_URL, and STRAVA_WEBHOOK_VERIFY_TOKEN first.');
  process.exit(1);
}
if (!callbackUrl.startsWith('https://')) {
  console.error('STRAVA_WEBHOOK_CALLBACK_URL must be a public HTTPS URL.');
  process.exit(1);
}

const endpoint = 'https://www.strava.com/api/v3/push_subscriptions';
const query = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
const existingResponse = await fetch(`${endpoint}?${query}`, { cache: 'no-store' });
if (!existingResponse.ok) {
  console.error(`Could not inspect the Strava webhook subscription (HTTP ${existingResponse.status}).`);
  process.exit(1);
}
const existing = await existingResponse.json();
if (Array.isArray(existing) && existing.length > 0) {
  if (existing[0].callback_url && existing[0].callback_url !== callbackUrl) {
    console.error(`A subscription already points to ${existing[0].callback_url}. Remove or update that subscription in Strava before configuring ${callbackUrl}.`);
    process.exit(1);
  }
  console.log(`A Strava webhook subscription already exists (id ${existing[0].id}). Set STRAVA_WEBHOOK_SUBSCRIPTION_ID=${existing[0].id}.`);
  process.exit(0);
}

const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, callback_url: callbackUrl, verify_token: verifyToken });
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body,
  cache: 'no-store',
});
const result = await response.json().catch(() => ({}));
if (!response.ok || !result.id) {
  console.error(`Strava did not create the webhook subscription (HTTP ${response.status}). Check that the callback is public and returns the challenge as JSON within two seconds.`);
  process.exit(1);
}
console.log(`Strava webhook subscription created (id ${result.id}). Set STRAVA_WEBHOOK_SUBSCRIPTION_ID=${result.id} in the app environment.`);
