// Test-only stand-in for the backend /api/v1/auth endpoints (shapes from the backend docs/api.md, 2026-11-17).
// Playwright starts it for the real-mode project; Vite proxies /api here via VITE_API_PROXY_TARGET.
// Not a backend implementation: in-memory, no hashing, reset per test through /__test__/reset.
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_AUTH_PORT ?? 8099);
let users, access, refresh, counter;
function reset() { users = new Map(); access = new Map(); refresh = new Map(); counter = 0; }
reset();

const send = (res, status, body) => {
  if (body === undefined) { res.writeHead(status); res.end(); return; }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=UTF-8' }); res.end(JSON.stringify(body));
};
const ok = (res, data, status = 200) => send(res, status, { success: true, data, error: null });
const fail = (res, status, code, message, data = null) => send(res, status, { success: false, data, error: { code, message } });
const issue = userId => {
  counter++; const pair = { accessToken: `access-${counter}`, refreshToken: `refresh-${counter}` };
  access.set(pair.accessToken, userId); refresh.set(pair.refreshToken, userId);
  return { ...pair, tokenType: 'Bearer', expiresIn: 86400 };
};
const readBody = req => new Promise(resolve => { let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(null); } }); });
const caller = req => access.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/__test__/reset') { reset(); return send(res, 204); }
  if (path === '/__test__/expire-access') { access.clear(); return send(res, 204); }
  if (path === '/__test__/expire-all') { access.clear(); refresh.clear(); return send(res, 204); }
  // Readiness probe, and (under /api/v1 through the Vite proxy) a check that the browser Origin is dropped.
  if (path === '/__test__/origin' || path === '/api/v1/__test__/origin') return ok(res, { origin: req.headers.origin ?? null });
  const body = req.method === 'POST' ? await readBody(req) : {};
  if (body === null) return fail(res, 400, 'INVALID_INPUT', '요청 값을 확인해 주세요.');
  switch (`${req.method} ${path}`) {
    case 'POST /api/v1/auth/signup': {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!email.includes('@') || String(body.password ?? '').length < 8 || !String(body.nickname ?? '').trim()) return fail(res, 400, 'INVALID_INPUT', '요청 값을 확인해 주세요.');
      if ([...users.values()].some(user => user.email === email)) return fail(res, 409, 'EMAIL_ALREADY_REGISTERED', '이미 해당 이메일로 가입된 계정이 있습니다.', { existingProvider: 'LOCAL', registeredEmail: email });
      const user = { userId: users.size + 1, email, nickname: String(body.nickname).trim(), password: body.password };
      users.set(user.userId, user);
      return ok(res, { userId: user.userId, email, nickname: user.nickname }, 201);
    }
    case 'POST /api/v1/auth/login': {
      const user = [...users.values()].find(item => item.email === String(body.email ?? '').trim().toLowerCase() && item.password === body.password);
      return user ? ok(res, { ...issue(user.userId), userId: user.userId, nickname: user.nickname }) : fail(res, 401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    case 'POST /api/v1/auth/refresh': {
      const userId = refresh.get(body.refreshToken);
      if (!userId) return fail(res, 401, 'INVALID_REFRESH_TOKEN', '유효하지 않은 토큰입니다.');
      refresh.delete(body.refreshToken); // rotation: the old refresh token is revoked
      const { refreshToken, ...rest } = issue(userId); return ok(res, { ...rest, refreshToken });
    }
    case 'GET /api/v1/auth/me': {
      const user = users.get(caller(req));
      return user ? ok(res, { userId: user.userId, email: user.email, nickname: user.nickname, provider: 'LOCAL' }) : fail(res, 401, 'UNAUTHORIZED', '인증이 필요합니다.');
    }
    case 'POST /api/v1/auth/logout': {
      if (!caller(req)) return fail(res, 401, 'UNAUTHORIZED', '인증이 필요합니다.');
      refresh.delete(body.refreshToken); return send(res, 204);
    }
    default: return fail(res, 404, 'NOT_FOUND', '없는 경로입니다.');
  }
}).listen(port, '127.0.0.1');
