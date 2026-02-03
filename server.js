import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DAY_MS = 24 * 60 * 60 * 1000;
const emailRate = new Map();
const ipRate = new Map();

function isRateLimited(map, key, windowMs = DAY_MS) {
  const now = Date.now();
  const last = map.get(key);
  if (last && now - last < windowMs) return true;
  map.set(key, now);
  return false;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function shortHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
}

async function createKey({ role, name }) {
  const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL;
  const AUTHENSOR_ADMIN_TOKEN = process.env.AUTHENSOR_ADMIN_TOKEN;

  if (!CONTROL_PLANE_URL || !AUTHENSOR_ADMIN_TOKEN) {
    throw new Error('Missing CONTROL_PLANE_URL or AUTHENSOR_ADMIN_TOKEN');
  }

  const response = await fetch(`${CONTROL_PLANE_URL.replace(/\/$/, '')}/keys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTHENSOR_ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, role }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.token) {
    const msg = data?.error?.message || JSON.stringify(data) || 'unknown error';
    throw new Error(`Key creation failed (${response.status}): ${msg}`);
  }

  return data.token;
}

async function sendEmail({ to, subject, text }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM;

  if (!RESEND_API_KEY || !RESEND_FROM) {
    throw new Error('Missing RESEND_API_KEY or RESEND_FROM');
  }

  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject,
    text,
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/request-demo-key', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (isRateLimited(emailRate, email) || isRateLimited(ipRate, ip)) {
      return res.status(429).json({ error: 'Rate limited. Try again later.' });
    }

    const id = shortHash(email);
    const ingest = await createKey({ role: 'ingest', name: `demo-ingest-${id}` });
    const executor = await createKey({ role: 'executor', name: `demo-executor-${id}` });

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || 'https://authensor-control-plane.onrender.com';

    const message = [
      'Your Authensor demo keys:',
      '',
      `Control Plane: ${controlPlaneUrl}`,
      `Ingest Key: ${ingest}`,
      `Executor Key: ${executor}`,
      '',
      'OpenClaw config snippet:',
      '{',
      '  skills: {',
      '    entries: {',
      '      "authensor-gateway": {',
      '        enabled: true,',
      '        env: {',
      `          CONTROL_PLANE_URL: "${controlPlaneUrl}",`,
      `          AUTHENSOR_API_KEY: "${executor}"`,
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
    ].join('\n');

    if (process.env.DEV_RETURN_KEYS === 'true') {
      return res.json({ ok: true, ingest, executor });
    }

    await sendEmail({
      to: email,
      subject: 'Your Authensor OpenClaw Demo Keys',
      text: message,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err?.message || err);
    return res.status(500).json({ error: 'Unable to issue demo key' });
  }
});

app.listen(port, () => {
  console.log(`Authensor demo key server running on :${port}`);
});
