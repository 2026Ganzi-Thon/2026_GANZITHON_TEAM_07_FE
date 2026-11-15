import { delay, http, HttpResponse } from 'msw';
import type { PreviewRequest } from '../features/chat/model';
import type { ResultDraft, ToyType } from '../lib/domain';
import { previewReply } from './dialogue';
import { store } from './store';
const unauthorized = () => HttpResponse.json({ message: '체험 계정으로 다시 들어와 주세요.' }, { status: 401 });
const fail = (request: Request) => request.headers.get('X-Preview-Failure') === 'once';
export const handlers = [
  http.get('/__preview__/me', () => HttpResponse.json(store.me())),
  http.post('/__preview__/login', async ({ request }) => {
    await delay(350);
    const { id } = await request.json() as { id: string };
    const user = store.login(id); return user ? HttpResponse.json(user) : unauthorized();
  }),
  http.post('/__preview__/logout', () => { store.logout(); return HttpResponse.json({ ok: true }); }),
  http.get('/__preview__/inventory', async () => {
    const owner = store.me()?.id; await delay(150); if (!owner || store.me()?.id !== owner) return unauthorized(); return HttpResponse.json(store.inventory());
  }),
  http.patch('/__preview__/inventory', async ({ request }) => {
    const owner = store.me()?.id; await delay(200); if (!owner || store.me()?.id !== owner) return unauthorized();
    const { type } = await request.json() as { type: ToyType };
    try { return HttpResponse.json(store.select(type)); } catch { return HttpResponse.json({ message: '선택할 수 없는 말랑이 종류예요.' }, { status: 400 }); }
  }),
  http.post('/__preview__/messages', async ({ request }) => {
    const owner = store.me()?.id; await delay(850); if (!owner || store.me()?.id !== owner) return unauthorized();
    if (fail(request)) return HttpResponse.json({ message: '예시 응답 오류' }, { status: 503 });
    return HttpResponse.json(previewReply(await request.json() as PreviewRequest));
  }),
  http.post('/__preview__/records', async ({ request }) => {
    const owner = store.me()?.id; await delay(550); if (!owner || store.me()?.id !== owner) return unauthorized();
    if (fail(request)) return HttpResponse.json({ message: '예시 기록 생성에 실패했어요.' }, { status: 503 });
    const { id, context, messages } = await request.json() as ResultDraft;
    try { return HttpResponse.json(store.save(id, context, messages), { status: 201 }); }
    catch { return HttpResponse.json({ message: '기록할 대화가 충분하지 않아요.' }, { status: 400 }); }
  }),
  http.get('/__preview__/records', async ({ request }) => {
    const owner = store.me()?.id; await delay(200); if (!owner || store.me()?.id !== owner) return unauthorized();
    if (fail(request)) return HttpResponse.json({ message: '기록을 불러오지 못했어요.' }, { status: 503 });
    return HttpResponse.json(store.list());
  }),
  http.get('/__preview__/records/:id', async ({ params }) => {
    const owner = store.me()?.id; await delay(150); if (!owner || store.me()?.id !== owner) return unauthorized();
    const record = store.get(String(params.id));
    return record ? HttpResponse.json(record) : HttpResponse.json({ message: '이 기록을 찾을 수 없어요.' }, { status: 404 });
  }),
  http.delete('/__preview__/records/:id', async ({ request, params }) => {
    const owner = store.me()?.id; await delay(350); if (!owner || store.me()?.id !== owner) return unauthorized();
    if (fail(request)) return HttpResponse.json({ message: '삭제하지 못했어요. 기록은 그대로 있어요.' }, { status: 503 });
    return store.delete(String(params.id)) ? HttpResponse.json({ ok: true }) : HttpResponse.json({ message: '이 기록을 찾을 수 없어요.' }, { status: 404 });
  }),
];
