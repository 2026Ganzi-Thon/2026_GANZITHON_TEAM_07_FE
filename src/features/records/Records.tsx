import { SettingsLink } from '../../components/SettingsLink';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Settings } from 'lucide-react';
import { ErrorState, Page, Pending, PrimaryLink } from '../../components/Page';
import { Avatar, Modal } from '../../components/ui';
import { Malangi } from '../../components/Malangi';
import { ApiError, previewApi } from '../../lib/api';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import { dateLabel, SLOT_LABELS, TOYS } from '../../lib/domain';
import type { DiaryRecord, ToyType } from '../../lib/domain';
import s from '../../components/Page.module.css';
import styles from './Records.module.css';
import chatStyles from '../chat/Chat.module.css';
import { EmotionSummary } from '../chat/Chat';
import { presentEmotion } from './archiveModel';
import { adviceFor } from './advice';

export function RecordBody({ record }: { record: DiaryRecord }) {
  const { context } = record;
  const difference = context.pre !== null && context.post !== null ? context.post - context.pre : null;
  return <><section className={styles.recordCard}><h2 className={styles.emotionTitle}>{context.primary ?? '감정 미선택'}{context.secondary ? ` · ${context.secondary}` : ''}</h2>{record.partial && <p className={s.small}>중간에 보관한 이야기예요. 남긴 내용만 보여드려요.</p>}<div className={styles.scoreRows}>{([['대화 전', context.pre], ['대화 후', context.post]] as const).map(([label, value]) => <div key={label}><span>{label}</span><span className={styles.track}><i style={{ width: `${(value ?? 0) * 10}%` }} /></span><strong>{value === null ? '미입력' : `${value}점`}</strong></div>)}</div><p className={s.small}>{difference === null ? '입력하지 않은 점수는 비교하지 않아요.' : difference === 0 ? '전후 점수가 같아요.' : `전보다 ${Math.abs(difference)}점 ${difference > 0 ? '높아졌어요' : '낮아졌어요'}.`}</p></section>
    <section className={styles.recordCard}><h2>내가 남긴 이야기</h2><dl className={styles.details}>{Object.entries(SLOT_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{context.slots[key as keyof typeof SLOT_LABELS] ?? '이 항목은 남기지 않았어요.'}</dd></div>)}</dl></section></>;

}
export function Result() {
  const { id = '' } = useParams(); const user = useProfile(); const preview = usePreview(); const client = useQueryClient();
  const draft = useRef(preview.drafts.get(id));
  const [selected, setSelected] = useState<ToyType | null>(null);
  const options = useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ['preview', user.data!.id, 'record', id], staleTime: Infinity, queryFn: () => {
    if (!draft.current) return previewApi.record(id);
    const fail = preview.faults.save; preview.faults.save = false;
    return previewApi.save(draft.current, fail);
  } });
  useEffect(() => { if (query.data) { preview.drafts.delete(id); draft.current = undefined; void client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'records'] }); void client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'inventory'] }); } }, [query.data, id, preview, client, user.data]);
  useEffect(() => setSelected(null), [id]);
  const active = selected ?? query.data?.recommended ?? 'SLANGI';
  const advice = query.data ? adviceFor(query.data) : null;
  if (query.data?.hidden || query.data?.partial) return <Page title="마음 기록"><p>{query.data.hidden ? '가려 둔 기록이에요.' : '중간에 보관한 이야기예요.'}</p><PrimaryLink to={`/records/${id}`}>기록 확인하기</PrimaryLink></Page>;
  return <Page title="오늘의 마음 정리" titlePlacement="hidden" className={styles.resultPage} action={<SettingsLink><Settings size={21} /></SettingsLink>}>{query.isPending ? <Pending>이야기를 정리하고 있어요.</Pending> : query.isError ? <><ErrorState message={query.error.message} retry={draft.current ? () => query.refetch() : undefined} /><p className={s.small}>{draft.current ? '저장 완료로 처리하지 않았어요. 다시 시도하면 입력 내용을 유지해요.' : '기록을 찾을 수 없어요. 새 대화를 시작할 수 있어요.'}</p></> : <div aria-label="상담 결과" role="region">
      <div className={styles.resultFirstView}>
      <section className={styles.recommend}><h2>지금 마음에 맞는 말랑이</h2><span className={styles.toyPill} aria-live="polite">{TOYS[active].name}</span><button className={styles.recommendArtwork} aria-label="다른 말랑이 선택 보기" onClick={() => { options.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); options.current?.querySelector<HTMLButtonElement>('button[aria-pressed=true]')?.focus({ preventScroll: true }); }}><Malangi variant={TOYS[active].tint} /></button><p>{TOYS[active].instruction}</p></section>
      <section className={styles.insight}><span>대화에서 남은 문장</span><blockquote>{query.data.summary}</blockquote>{advice && <p className={styles.smallAction}><img src={`/assets/design/advice-${advice.kind}.svg`} width={advice.kind === 'walk' ? 14 : 15} height={advice.kind === 'walk' ? 12 : 10} alt="" /><span>{advice.chosen ? '작은 실천' : '작은 조언'} · {advice.text}</span></p>}</section>
      <section className={styles.alternatives} aria-label="다른 말랑이"><header><h2>다른 말랑이도 있어요</h2><span>눌러서 바꿀 수 있어요</span></header><div ref={options} role="group" aria-label="체험할 말랑이 선택">{(Object.keys(TOYS) as ToyType[]).map(type => {
        const content = <><i className={styles[type]} /><strong>{TOYS[type].name}</strong><small>{({ SLANGI: '불안 · 우울', SQUISHY: '속상함 · 슬픔', WAKPPU: '분노 · 스트레스' })[type]}</small></>;
        return <button key={type} aria-label={`${TOYS[type].name} 선택`} aria-pressed={active === type} onClick={() => setSelected(type)}>{content}</button>;
      })}</div></section>
      <div className={styles.resultActions}><PrimaryLink to={`/malangi?type=${active}`}>{TOYS[active].name} 만지러 가기</PrimaryLink><Link className={styles.recordLink} to={`/records/${id}`}>저장된 기록 확인하기<ChevronRight size={12} /></Link></div>
      </div>
      <div className={styles.saved} role="status"><Check size={14} />기록을 보관함에 남겼어요</div>
      <RecordBody record={query.data} /><div className={s.stack}><Link className={s.secondary} to="/archive">마음 보관함으로</Link><Link className={s.textLink} to="/">메인으로 돌아가기</Link></div>
    </div>}</Page>;

}
export { Archive } from './Archive';
const emotionColor = (emotion: string | null) => presentEmotion(emotion).color;
export function RecordDetail() {
  const location = useLocation();
  const { id = '' } = useParams(); const user = useProfile(); const preview = usePreview(); const client = useQueryClient(); const navigate = useNavigate(); const [confirm, setConfirm] = useState(false);
  const query = useQuery({ queryKey: ['preview', user.data!.id, 'record', id], queryFn: () => previewApi.record(id) });
  const [params, setParams] = useSearchParams(); const history = params.get('view') === 'conversation'; const [revealed, setRevealed] = useState(false);
  const back = params.get('manage') === '1' ? '/archive?manage=1' : '/archive';
  useEffect(() => { setRevealed(false); }, [id, query.data?.hidden]);
  const visibility = useMutation({ mutationFn: () => previewApi.setRecordHidden(id, !query.data?.hidden), onSuccess: async record => {
    await client.cancelQueries({ queryKey: ['preview', user.data!.id, 'records'] });
    client.setQueryData(['preview', user.data!.id, 'record', id], record);
    client.setQueryData<DiaryRecord[]>(['preview', user.data!.id, 'records'], previous => previous?.map(item => item.id === record.id ? record : item));
    await client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'records'] });
    setRevealed(false);
  } });
  const remove = useMutation({ mutationFn: () => { const fail = preview.faults.remove; preview.faults.remove = false; return previewApi.deleteRecord(id, fail); }, onSuccess: async () => {
    preview.drafts.delete(id); client.removeQueries({ queryKey: ['preview', user.data!.id, 'record', id] }); await client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'records'] }); navigate(back, { replace: true });
  } });
  const record = query.data;
  const cardActions = record && <footer className={styles.recordActions}>
    <button aria-label={record.hidden ? '보관함에 다시 표시하기' : '기록 가리기'} disabled={visibility.isPending} onClick={() => visibility.mutate()}>{visibility.isPending ? '변경 중…' : record.hidden ? '다시 표시' : '숨기기'}</button>
    <button className={styles.deleteRecord} aria-label="기록 삭제" disabled={visibility.isPending} onClick={event => { event.currentTarget.focus(); setConfirm(true); }}>삭제</button>
    {!record.hidden || revealed ? <button className={styles.detailLink} aria-label="대화 자세히 보기" onClick={() => { const next = new URLSearchParams(params); next.set('view', 'conversation'); setParams(next, { state: location.state }); }}>자세히 보기<ChevronRight size={13} /></button> : null}
  </footer>;
  return <Page className={styles.detailPage} title={record ? new Date(record.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }) : '마음 기록'} back={history ? `/records/${id}${params.get('manage') === '1' ? '?manage=1' : ''}` : back} backState={location.state}>
    {query.isPending ? <Pending /> : query.isError ? <ErrorState message={query.error.message} retry={query.error instanceof ApiError && query.error.status === 404 ? undefined : () => query.refetch()} /> : record && <>
      {visibility.isError && <p role="alert" className={s.error}>{visibility.error.message} 다시 눌러주세요.</p>}
      {record.hidden && !revealed ? <section className={styles.recordCard}><h2>가려 둔 기록이에요</h2><button className={s.secondary} onClick={() => setRevealed(true)}>이번에만 내용 보기</button>{cardActions}</section> : history ? <section className={styles.transcript} aria-label="저장된 대화 내용">
        {record.messages?.length ? record.messages.map(message => <div key={message.id} className={`${chatStyles.message} ${message.role === 'user' ? chatStyles.user : chatStyles.assistant}`}>
          {message.role === 'assistant' && <span className={chatStyles.messageAvatar}><Avatar /></span>}<div className={chatStyles.bubble}>{message.text}</div><time className={chatStyles.time}>{message.time}</time>
        </div>) : <p>이 기록에는 대화 원문이 없어요.</p>}
        {record.context.primary && record.context.pre !== null && <EmotionSummary primary={record.context.primary} secondary={record.context.secondary} situation={record.context.slots.OPEN} score={record.context.pre} time={dateLabel(record.createdAt)} />}
      </section> : <>
        <section className={styles.detailSummary} aria-label="기록 요약">
          <header className={styles.summaryMeta}><span className={styles.recordMeta}><i className={styles.emotionDot} style={{ background: emotionColor(record.context.primary) }} />{record.context.primary ?? '감정 미선택'} <time>{new Date(record.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</time></span>{record.recommended && <span className={styles.recommendTag}>{TOYS[record.recommended].name} 추천</span>}</header>
          <h2 className={styles.recordSummary}>{record.summary}</h2>
          <div className={styles.scoreRows}>{([['상담 전', record.context.pre], ['상담 후', record.context.post]] as const).map(([label, value]) => <div key={label}><span>{label}</span><span className={styles.track}><i style={{ width: `${(value ?? 0) * 10}%` }} /></span><strong>{value === null ? '미입력' : value}</strong></div>)}</div>
          {record.partial && <p className={styles.partialNote}>중간에 보관한 이야기</p>}
          <dl className={styles.summaryThoughts}>{(['THOUGHT', 'REFRAME', 'NEED', 'COPING'] as const).map(key => record.context.slots[key] && <div key={key} data-perspective={key === 'REFRAME'}><dt>{({ THOUGHT: '그때의 생각', REFRAME: '새로운 관점', NEED: '바랐던 마음', COPING: '도움이 된 일' })[key]}</dt><dd>{record.context.slots[key]}</dd></div>)}</dl>
          {record.context.slots.ACTION && <p className={styles.recordAction}><Check size={13} /><span>작은 실천 · {record.context.slots.ACTION}</span></p>}
          {cardActions}
        </section>
        {record.recommended && <section className={styles.usedToy}><h2>당시 추천 말랑이 · {TOYS[record.recommended].name}</h2><Malangi variant={TOYS[record.recommended].tint} /><PrimaryLink to={`/malangi?type=${record.recommended}`}>말랑이 만나기</PrimaryLink></section>}
      </>}<Link className={s.secondary} to={back}>{params.get('manage') === '1' ? '기록 관리로' : '마음 보관함으로'}</Link>
    </>}
    {confirm && <Modal title="이 기록을 지울까요?" dismissible={!remove.isPending} onClose={() => { if (!remove.isPending) setConfirm(false); }}><p>이 기록과 대화 내용을 지워요. 삭제한 기록은 되돌릴 수 없어요.</p>{remove.isError && <p className={s.error} role="alert">{remove.error.message}</p>}<div className={s.stack}><button className={`${s.primary} ${s.danger}`} onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending ? '지우고 있어요…' : remove.isError ? '다시 삭제하기' : '기록 지우기'}</button><button className={s.secondary} onClick={() => setConfirm(false)} disabled={remove.isPending}>기록 유지하기</button></div></Modal>}
  </Page>;
}
