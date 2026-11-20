// Test-only stand-in for auth plus opt-in counseling/records scenarios (deployed contracts, 2026-11-20).
// Playwright starts it for the real-mode project; Vite proxies /api here via VITE_API_PROXY_TARGET.
// Not a backend implementation: in-memory, no hashing, reset per test through /__test__/reset.
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_AUTH_PORT ?? 8099);
let users, access, refresh, counter;
let counseling = null;
let holdAuth = false, failAuthMe = false;
const authWaiters = new Set();
function reset() { holdAuth=false;failAuthMe=false;authWaiters.forEach(resolve=>resolve());authWaiters.clear();users = new Map(); access = new Map(); refresh = new Map(); counter = 0; }
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
  if (path === '/__test__/reset') { counseling=null; reset(); return send(res, 204); }
  if (path === '/__test__/expire-access') { access.clear(); return send(res, 204); }
  if (path === '/__test__/expire-all') { access.clear(); refresh.clear(); return send(res, 204); }
  // Readiness probe, and (under /api/v1 through the Vite proxy) a check that the browser Origin is dropped.
  if (path === '/__test__/origin' || path === '/api/v1/__test__/origin') return ok(res, { origin: req.headers.origin ?? null });
  const body = ['POST','PATCH'].includes(req.method) ? await readBody(req) : {};
  if (body === null) return fail(res, 400, 'INVALID_INPUT', '요청 값을 확인해 주세요.');
  if (path === '/__test__/auth-probe') {
    if(req.method === 'POST') {
      holdAuth=!!body.hold;failAuthMe=!!body.fail;
      if(!holdAuth){authWaiters.forEach(resolve=>resolve());authWaiters.clear();}
      return send(res,204);
    }
    return send(res,200,{pending:authWaiters.size});
  }
  if (path === '/__test__/counseling') {
    if (req.method === 'POST') { counseling={ options:body, requests:[], saved:false, hidden:false }; return send(res,204); }
    return send(res,200,counseling?.requests ?? []);
  }
  if (counseling && (path.startsWith('/api/v1/counseling/') || path.startsWith('/api/v1/records'))) {
    if (!caller(req)) return fail(res,401,'UNAUTHORIZED','인증이 필요합니다.');
    const c=counseling; c.requests.push({path,method:req.method,body});
    const turn=(nextInput,aiMessage,emotionCard=null)=>({sessionId:9,status:'IN_PROGRESS',currentStep:'STEP_02',riskDetected:false,emergencyHotlines:[],replyOptions:[],nextInput,aiMessage,emotionCard});
    const record=()=>({resultId:77,sessionId:9,createdAt:c.options.createdAt??'2026-11-19T18:00:00.123456',date:'2026-11-20',time:'03:00',primaryEmotion:'분노',secondaryEmotion:null,preIntensity:7,postIntensity:0,summary:'발표 준비가 속상했어요',keySentence:'내 의견도 중요해요',situation:'발표 준비',initialThought:'의견이 무시됐어요',alternativeThought:null,underlyingNeed:null,copingStrategy:null,actionPlan:'잠깐 쉬기',recommendedMalangi:c.options.recommended??'WAKPPU',hidden:c.hidden});
    if(path.endsWith('/counseling/sessions')) return ok(res,c.options.risk ? {...turn('NONE','잠시 대화를 멈추겠소.'),riskDetected:true,status:'ABORTED_RISK'} : c.options.early ? turn('POST_INTENSITY','마음을 정리해 보겠소.') : turn('EMOTION_CARD','그 마음을 함께 정리해 보겠소.',{triggerFactor:'발표 준비',primaryEmotions:['분노','서운함'],secondaryEmotions:['허무함']}),201);
    if(path.endsWith('/emotion')) return ok(res,turn('MESSAGE',null));
    if(path.endsWith('/counseling/sessions/9/messages')) return c.options.failMessage ? fail(res,503,'UNAVAILABLE','잠시 연결하지 못했어요.') : ok(res,turn('POST_INTENSITY','지금 마음의 크기를 알려주시오.'));
    if(path.endsWith('/complete')) {c.saved=true;return ok(res,{status:'COMPLETED',resultId:77,sessionId:9});}
    if(path.endsWith('/abort')) {
      if(c.options.abortDelay) await new Promise(resolve=>setTimeout(resolve,c.options.abortDelay));
      return c.options.failAbort ? fail(res,503,'UNAVAILABLE','연결 실패') : ok(res,{sessionId:9,status:'ABORTED'});
    }
    if(path==='/api/v1/records') {
      if(c.options.recordsDelay) await new Promise(resolve=>setTimeout(resolve,c.options.recordsDelay));
      if(c.options.failRecords) return fail(res,503,'UNAVAILABLE','기록을 불러오지 못했어요.');
      return ok(res,{content:c.saved?[record()]:[],pageNumber:0,last:true,totalPages:c.saved?1:0,totalElements:c.saved?1:0,pageSize:50});
    }
    if(path.endsWith('/records/77/messages')) return ok(res,{messages:[{messageId:1,type:'USER',content:'발표 준비',time:'03:00'},{messageId:2,type:'ASSISTANT',content:'그랬겠소.',time:'03:01'},{messageId:3,type:'SYSTEM',content:'INTERNAL',time:'03:01'}]});
    if(path.endsWith('/records/77/hidden')) {c.hidden=body.hidden;return ok(res,{resultId:77,hidden:c.hidden});}
    if(path.endsWith('/records/77')) {if(req.method==='DELETE'){c.saved=false;return send(res,204);}if(c.options.recordDelay) await new Promise(resolve=>setTimeout(resolve,c.options.recordDelay));return ok(res,record());}
  }
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
    case 'GET /api/v1/records': {
      return caller(req) ? ok(res, {content:[],pageNumber:0,last:true,totalPages:0,totalElements:0,pageSize:50}) : fail(res,401,'UNAUTHORIZED','인증이 필요합니다.');
    }
    case 'GET /api/v1/auth/me': {
      if(holdAuth) await new Promise(resolve=>authWaiters.add(resolve));
      if(failAuthMe) return fail(res,503,'UNAVAILABLE','일시적으로 확인할 수 없습니다.');
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
