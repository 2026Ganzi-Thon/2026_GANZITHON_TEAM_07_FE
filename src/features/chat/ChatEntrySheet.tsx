import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ArrowUp } from 'lucide-react';
import { Avatar } from '../../components/ui';
import { BottomSheet } from '../../components/BottomSheet';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import { API_MODE } from '../../lib/apiMode';
import { counselingApi } from '../../lib/counselingApi';
import type { Conversation } from './LiveChat';
import styles from './ChatEntrySheet.module.css';

export function useChatEntry() {
  const preview = usePreview();
  const navigate = useNavigate();
  const profile = useProfile();
  const client = useQueryClient();
  const key = ['preview', profile.data?.id, 'live-chat'];
  // Observe only the existing tab cache; this never fetches or creates a server session.
  const cached = useQuery<Conversation | null>({ queryKey:key, queryFn:async () => null, enabled:false, gcTime:Infinity });
  const paused = API_MODE === 'real' && !!profile.data && cached.data?.paused && !cached.data.resultId &&
    (!cached.data.turn || cached.data.turn.status === 'IN_PROGRESS' && cached.data.turn.nextInput !== 'NONE' && !cached.data.turn.riskDetected) ? cached.data : null;
  const [draft, setDraft] = useState(() => preview.entry?.text ?? '');
  useEffect(() => { preview.entry = null; }, [preview]);
  function start() {
    if (paused) return;
    preview.entry = draft.trim() ? { text: draft.trim() } : null;
    navigate('/chat');
  }
  function resume() { if (!paused) return; preview.entry = null; navigate('/chat'); }
  async function discardPaused() {
    const current = client.getQueryData<Conversation>(key);
    if (!current?.paused) throw new Error('이어갈 대화 상태가 바뀌었어요. 창을 닫고 다시 확인해 주세요.');
    if (current.turn?.status === 'IN_PROGRESS') await counselingApi.abort(current.turn.sessionId);
    // Never erase another conversation or account if state changed during the request.
    if (client.getQueryData(key) !== current) return;
    client.setQueryData(key, null);
    preview.entry = null; setDraft('');
  }
  return { draft, setDraft, start, paused, resume, discardPaused };
}

export function ChatEntrySheet({ id, entry, onClose }: {
  id: string; entry: ReturnType<typeof useChatEntry>; onClose: () => void;
}) {
  const [confirmNew, setConfirmNew] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function replace() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await entry.discardPaused(); setConfirmNew(false); }
    catch { setError('기존 대화의 종료를 확인하지 못했어요. 새 이야기는 시작하지 않았어요.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <BottomSheet id={id} title={entry.paused ? confirmNew ? '새 이야기를 시작할까요?' : '이야기를 이어갈까요?' : '테스와 이야기하기'} onClose={onClose} dismissible={!pending}>
    {entry.paused ? <div className={styles.chatEntry}>
      <div className={styles.tess}><Avatar /><span>테스</span></div>
      <p className={styles.note}>{confirmNew ? '기존 대화와 보내지 않은 글은 저장하지 않고 종료해요. 보관함에 남기고 싶다면 이전 대화로 돌아가 마무리해 주세요.' : '잠시 나간 이야기가 있어요. 나눴던 대화와 작성 중인 글을 그대로 이어갈 수 있어요.'}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {confirmNew ? <>
        <button className={`${styles.begin} ${styles.centered}`} disabled={pending || !!error} onClick={() => void replace()}>{pending ? '기존 대화를 마무리하고 있어요…' : '저장 없이 종료하고 새로 시작'}</button>
        <button className={styles.secondary} disabled={pending} onClick={() => { setConfirmNew(false); setError(''); }}>이전 대화 유지하기</button>
      </> : <>
        <button className={`${styles.begin} ${styles.centered}`} onClick={entry.resume}><span>이전 대화 이어하기</span> <ArrowUp size={18} aria-hidden="true" /></button>
        <button className={styles.secondary} onClick={() => setConfirmNew(true)}>새 이야기 시작하기</button>
      </>}
    </div> : <form className={styles.chatEntry} onSubmit={event => { event.preventDefault(); entry.start(); }}>
      <div className={styles.tess}><Avatar /><span>테스</span></div>
      <textarea aria-label="첫 이야기" placeholder="어떤 일이 있었나요?" value={entry.draft} onChange={event => entry.setDraft(event.target.value)} maxLength={2000} rows={3} />
      <button type="submit" className={styles.begin}>대화 시작하기 <ArrowUp size={18} aria-hidden="true" /></button>
    </form>}
  </BottomSheet>;
}
