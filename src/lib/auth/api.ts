export type AuthUser = { email: string; nickname: string };

type AuthResult = { token?: string; user?: AuthUser; error?: string };

async function postJson(url: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function errorOf(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? 'request_failed';
  } catch {
    return 'request_failed';
  }
}

export async function registerAccount(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthResult> {
  const res = await postJson('/api/auth/register', { email, password, nickname });
  if (res.status === 200) return (await res.json()) as AuthResult;
  return { error: await errorOf(res) };
}

export async function loginAccount(email: string, password: string): Promise<AuthResult> {
  const res = await postJson('/api/auth/login', { email, password });
  if (res.status === 200) return (await res.json()) as AuthResult;
  return { error: await errorOf(res) };
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function logoutAccount(token: string): Promise<void> {
  await postJson('/api/auth/logout', {}, token).catch(() => {});
}
