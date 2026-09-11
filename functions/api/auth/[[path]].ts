/**
 * 认证 API（Cloudflare Pages Functions，边缘运行）
 * 路由：/api/auth/register | login | logout | me
 * 存储：AUTH_KV（Cloudflare KV）
 * 安全：PBKDF2-SHA256 口令哈希 + HMAC-SHA256 JWT（AUTH_SECRET 签名）
 *
 * 注意：本地 vite dev 不执行本函数（仅代理 /api/v1/ai/*），
 *       故本地开发时认证端点返回 503，客户端优雅降级。
 */

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface AuthEnv {
  AUTH_KV?: KVNamespace;
  AUTH_SECRET?: string;
}

type PagesContext = {
  request: Request;
  env?: AuthEnv;
  params?: { path?: string | string[] };
};

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 天（秒）

function segment(ctx: PagesContext): string {
  const p = ctx.params?.path;
  if (Array.isArray(p)) return (p[0] ?? '').toString();
  if (typeof p === 'string') return p.split('/')[0];
  const m = new URL(ctx.request.url).pathname.match(/\/api\/auth\/([^/]+)/);
  return m ? m[1] : '';
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '===='.slice(0, pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(obj: unknown): string {
  return bufToB64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bufToB64url(sig);
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const data = `${header}.${body}`;
  const sig = await hmac(data, secret);
  return `${data}.${sig}`;
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const expected = await hmac(`${h}.${b}`, secret);
  if (expected !== s) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(b)));
  } catch {
    return null;
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return bufToB64url(bits);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function onRequest(ctx: PagesContext): Promise<Response> {
  const seg = segment(ctx);
  const method = ctx.request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
    });
  }

  if (!ctx.env?.AUTH_KV || !ctx.env?.AUTH_SECRET) {
    return json({ error: 'auth_unavailable' }, 503);
  }
  const kv = ctx.env.AUTH_KV;
  const secret = ctx.env.AUTH_SECRET;

  if (seg === 'register' && method === 'POST') {
    const body = await readJson(ctx.request);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const nickname = String(body.nickname ?? '').trim() || email.split('@')[0];
    if (!EMAIL_RE.test(email) || password.length < 8) return json({ error: 'invalid_input' }, 400);
    if (await kv.get(`user:${email}`)) return json({ error: 'email_taken' }, 409);
    const salt = bufToB64url(crypto.getRandomValues(new Uint8Array(16)));
    const pwHash = await hashPassword(password, salt);
    await kv.put(`user:${email}`, JSON.stringify({ email, nickname, salt, pwHash, createdAt: Date.now() }));
    return json({ ok: true });
  }

  if (seg === 'login' && method === 'POST') {
    const body = await readJson(ctx.request);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const raw = await kv.get(`user:${email}`);
    if (!raw) return json({ error: 'invalid_credentials' }, 401);
    const user = JSON.parse(raw) as { email: string; nickname: string; salt: string; pwHash: string };
    if ((await hashPassword(password, user.salt)) !== user.pwHash) {
      return json({ error: 'invalid_credentials' }, 401);
    }
    const sid = bufToB64url(crypto.getRandomValues(new Uint8Array(24)));
    const token = await signJwt({ sub: email, sid, exp: Date.now() + SESSION_TTL * 1000 }, secret);
    await kv.put(`session:${sid}`, email, { expirationTtl: SESSION_TTL });
    return json({ token, user: { email: user.email, nickname: user.nickname } });
  }

  if (seg === 'logout' && method === 'POST') {
    const auth = ctx.request.headers.get('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? await verifyJwt(token, secret) : null;
    if (payload?.sid) await kv.delete(`session:${payload.sid}`);
    return json({ ok: true });
  }

  if (seg === 'me' && method === 'GET') {
    const auth = ctx.request.headers.get('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return json({ user: null });
    const payload = await verifyJwt(token, secret);
    if (!payload?.sid) return json({ user: null });
    if (!(await kv.get(`session:${payload.sid}`))) return json({ user: null });
    const raw = await kv.get(`user:${String(payload.sub ?? '')}`);
    if (!raw) return json({ user: null });
    const user = JSON.parse(raw) as { email: string; nickname: string };
    return json({ user: { email: user.email, nickname: user.nickname } });
  }

  return json({ error: 'not_found' }, 404);
}
