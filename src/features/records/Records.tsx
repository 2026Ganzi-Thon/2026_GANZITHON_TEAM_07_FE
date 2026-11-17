import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Heart, Settings, Trash2 } from 'lucide-react';
import { ErrorState, Page, Pending, PrimaryLink } from '../../components/Page';
import { Avatar, IconButton, Modal } from '../../components/ui';
import { Malangi } from '../../components/Malangi';
import { ApiError, previewApi } from '../../lib/api';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import { dateLabel, localDate, SLOT_LABELS, TOYS } from '../../lib/domain';
import type { DiaryRecord, ToyType } from '../../lib/domain';
import s from '../../components/Page.module.css';
import styles from './Records.module.css';
import chatStyles from '../chat/Chat.module.css';
import { EmotionSummary } from '../chat/Chat';

export function RecordBody({ record }: { record: DiaryRecord }) {
  const { context } = record;
  const difference = context.pre !== null && context.post !== null ? context.post - context.pre : null;
  return <><section className={styles.recordCard}><h2 className={styles.emotionTitle}>{context.primary}{context.secondary ? ` · ${context.secondary}` : ''}</h2><div className={styles.scoreRows}>{([['대화 전', context.pre], ['대화 후', context.post]] as const).map(([label, value]) => <div key={label}><span>{label}</span><span className={styles.track}><i style={{ width: `${(value ?? 0) * 10}%` }} /></span><strong>{value === null ? '미입력' : `${value}점`}</strong></div>)}</div><p className={s.small}>{difference === null ? '입력하지 않은 점수는 비교하지 않아요.' : difference === 0 ? '전후 점수가 같아요.' : `전보다 ${Math.abs(difference)}점 ${difference > 0 ? '높아졌어요' : '낮아졌어요'}.`}</p></section>
    <section className={styles.recordCard}><h2>내가 남긴 이야기</h2><dl className={styles.details}>{Object.entries(SLOT_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{context.slots[key as keyof typeof SLOT_LABELS] ?? '이 항목은 남기지 않았어요.'}</dd></div>)}</dl></section></>;

}
export function Result() {
  const { id = '' } = useParams(); const user = useProfile(); const preview = usePreview(); const client = useQueryClient();
  const draft = useRef(preview.drafts.get(id));
  const query = useQuery({ queryKey: ['preview', user.data!.id, 'record', id], staleTime: Infinity, queryFn: () => {
    if (!draft.current) return previewApi.record(id);
    const fail = preview.faults.save; preview.faults.save = false;
    return previewApi.save(draft.current, fail);
  } });
  useEffect(() => { if (query.data) { preview.drafts.delete(id); draft.current = undefined; void client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'records'] }); void client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'inventory'] }); } }, [query.data, id, preview, client, user.data]);
  return <Page title="오늘의 마음 정리" titlePlacement="hidden" className={styles.resultPage} action={<Link to="/settings" aria-label="MY 및 설정"><Settings size={21} /></Link>}>{query.isPending ? <Pending>이야기를 정리하고 있어요.</Pending> : query.isError ? <><ErrorState message={query.error.message} retry={draft.current ? () => query.refetch() : undefined} /><p className={s.small}>{draft.current ? '저장 완료로 처리하지 않았어요. 다시 시도하면 입력 내용을 유지해요.' : '기록을 찾을 수 없어요. 새 대화를 시작할 수 있어요.'}</p></> : <div aria-label="상담 결과" role="region">
      <section className={styles.recommend}><h2>지금 마음에 맞는 말랑이</h2><span className={styles.toyPill}>{TOYS[query.data.recommended].name}</span><Link to={`/malangi?type=${query.data.recommended}`} aria-label={`추천 ${TOYS[query.data.recommended].name} 체험하기`}><Malangi variant={TOYS[query.data.recommended].tint} /></Link><p>{TOYS[query.data.recommended].instruction}</p></section>
      <section className={styles.insight}><span>대화에서 남은 문장</span><blockquote>{query.data.summary}</blockquote>{query.data.context.slots.ACTION && <p>{query.data.context.slots.ACTION}</p>}</section>
      <section className={styles.alternatives} aria-label="다른 말랑이"><h2>다른 말랑이도 있어요</h2><div>{(Object.keys(TOYS) as ToyType[]).map(type => {
        const content = <><i className={styles[type]} /><strong>{TOYS[type].name}</strong><small>{({ SLANGI: '불안 · 우울', SQUISHY: '속상함 · 슬픔', WAKPPU: '분노 · 스트레스' })[type]}</small></>;
        return <Link key={type} aria-label={`${TOYS[type].name} 선택해서 체험하기`} to={`/malangi?type=${type}`}>{content}</Link>;
      })}</div></section>
      <div className={styles.resultActions}><PrimaryLink to={`/malangi?type=${query.data.recommended}`}>{TOYS[query.data.recommended].name} 만지러 가기</PrimaryLink><Link className={styles.recordLink} to={`/records/${id}`}>저장된 기록 확인하기<ChevronRight size={12} /></Link></div>
      <div className={styles.saved} role="status"><Check size={14} />기록을 보관함에 남겼어요</div>
      <RecordBody record={query.data} /><div className={s.stack}><Link className={s.secondary} to="/archive">마음 보관함으로</Link><Link className={s.textLink} to="/">메인으로 돌아가기</Link></div>
    </div>}</Page>;

}
const emotionColors: Record<string, string> = { 불안: '#9479d8', 분노: '#ce7161', 속상함: '#cc9b4f', 슬픔: '#728eb7', 스트레스: '#bf8292', 우울: '#887f9f' };
const emotionColor = (emotion: string | null) => emotionColors[emotion ?? ''] ?? '#868079';
function weekStart(value: string) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() - date.getDay()); return date; }
export function Archive() {
  const user = useProfile(); const preview = usePreview();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => localDate(new Date()));
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const query = useQuery({ queryKey: ['preview', user.data!.id, 'records'], queryFn: () => { const fail = preview.faults.list; preview.faults.list = false; return previewApi.records(fail); } });
  const records = query.data ?? []; const daily = records.filter(r => localDate(r.createdAt) === selected);
  const monthly = records.filter(r => localDate(r.createdAt).slice(0, 7) === localDate(month).slice(0, 7));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); const offset = month.getDay();
  const start = weekStart(selected);
  const dates = view === 'week' ? Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)) : Array.from({ length: days }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
  function move(delta: number) {
    const date = view === 'week' ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta * 7) : new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelected(localDate(date));
  }
  function today() { const date = new Date(); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelected(localDate(date)); }
  const visible = view === 'list' ? monthly : daily;
  const frequency = Object.entries(monthly.reduce<Record<string, number>>((result, record) => { const key = record.context.primary!; result[key] = (result[key] ?? 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]);
  return <Page title="마음 보관함" titlePlacement="body" className={styles.archivePage} action={<Link to="/settings" aria-label="MY 및 설정"><Settings size={21} /></Link>}>
    <p className={styles.archiveCaption}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} · 기록 {records.length}개</p>
    {query.isPending ? <Pending>기록을 불러오고 있어요.</Pending> : query.isError ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : <>
      <div className={styles.tabs} role="group" aria-label="기록 보기 방식">{([['month','월간'],['week','주간'],['list','목록']] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div>
      <section className={styles.calendar} aria-label={view === 'week' ? '주간 기록 달력' : view === 'month' ? '월간 기록 달력' : '기록 월 선택'}>
        <div className={styles.month}><IconButton label={view === 'week' ? '이전 주' : '이전 달'} onClick={() => move(-1)}><ChevronLeft size={16} /></IconButton><h2>{month.getFullYear()}년 {month.getMonth() + 1}월</h2><IconButton label={view === 'week' ? '다음 주' : '다음 달'} onClick={() => move(1)}><ChevronRight size={16} /></IconButton><button className={styles.today} onClick={today}>오늘</button></div>
        {view !== 'list' && <><div className={styles.grid}>{['일','월','화','수','목','금','토'].map(day => <span className={styles.weekday} key={day}>{day}</span>)}{view === 'month' && Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}{dates.map(date => { const key = localDate(date); const entries = records.filter(r => localDate(r.createdAt) === key); return <button key={key} aria-label={`${key}, 기록 ${entries.length}개`} aria-pressed={selected === key} aria-current={key === localDate(new Date()) ? 'date' : undefined} onClick={() => { setSelected(key); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}>{date.getDate()}<span className={styles.dots} aria-hidden="true">{[...new Set(entries.map(record => record.context.primary))].slice(0, 3).map(emotion => <i key={emotion} style={{ background: emotionColor(emotion) }} />)}</span></button>; })}</div><div className={styles.legend}>{Object.entries(emotionColors).map(([emotion, color]) => <span key={emotion}><i style={{ background: color }} />{emotion}</span>)}</div></>}
      </section>
      <section aria-label="선택 날짜 기록"><h2 className={styles.dayTitle}>{view === 'list' ? `${month.getMonth() + 1}월 기록` : `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일의 마음`} <span>{visible.length}</span></h2>{visible.length ? <div className={styles.recordList}>{visible.map(record => <Link key={record.id} to={`/records/${record.id}`}><span><i className={styles.emotionDot} style={{ background: emotionColor(record.context.primary) }} />{record.context.primary} · {dateLabel(record.createdAt)}</span><strong>{record.summary}</strong><p>강도 {record.context.pre ?? '—'} → {record.context.post ?? '—'} · {TOYS[record.recommended].name}</p><ChevronRight size={16} /></Link>)}</div> : <div className={s.empty}><Heart size={28} strokeWidth={1.2} /><h2>{records.length ? '이날 남긴 기록이 없어요' : '아직 기록이 없어요'}</h2><p>테스와 이야기하고 마음을 남겨보세요.</p><PrimaryLink to="/chat">마음 이야기하기</PrimaryLink></div>}</section>
      {frequency.length > 0 && <section className={styles.frequency} aria-label="월간 감정 기록 횟수"><h2>{month.getMonth() + 1}월 돌아보기</h2><p>대표 감정별 기록 횟수</p>{frequency.map(([emotion, count]) => <div key={emotion}><span>{emotion}</span><span className={styles.track}><i style={{ width: `${count / monthly.length * 100}%`, background: emotionColor(emotion) }} /></span><small>{count}회</small></div>)}</section>}
    </>}
  </Page>;
}
export function RecordDetail() {
  const { id = '' } = useParams(); const user = useProfile(); const preview = usePreview(); const client = useQueryClient(); const navigate = useNavigate(); const [confirm, setConfirm] = useState(false); const [history, setHistory] = useState(false);
  const query = useQuery({ queryKey: ['preview', user.data!.id, 'record', id], queryFn: () => previewApi.record(id) });
  const remove = useMutation({ mutationFn: () => { const fail = preview.faults.remove; preview.faults.remove = false; return previewApi.deleteRecord(id, fail); }, onSuccess: async () => {
    preview.drafts.delete(id); client.removeQueries({ queryKey: ['preview', user.data!.id, 'record', id] }); await client.invalidateQueries({ queryKey: ['preview', user.data!.id, 'records'] }); navigate('/archive', { replace: true });
  } });
  return <Page className={styles.detailPage} title={query.data ? new Date(query.data.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }) : '마음 기록'} back="/archive" action={query.data && <IconButton label="기록 삭제" onClick={() => setConfirm(true)}><Trash2 size={19} /></IconButton>}>
    {query.isPending ? <Pending /> : query.isError ? <ErrorState message={query.error.message} retry={query.error instanceof ApiError && query.error.status === 404 ? undefined : () => query.refetch()} /> : <>
      <div className={styles.detailSummary}><section className={styles.recordCard}><span className={styles.recordMeta}><i className={styles.emotionDot} style={{ background: emotionColor(query.data.context.primary) }} />{query.data.context.primary} · {dateLabel(query.data.createdAt)}</span><h2 className={styles.recordSummary}>{query.data.summary}</h2></section>
      <RecordBody record={query.data} />
      <button className={styles.historyButton} aria-expanded={history} onClick={() => setHistory(!history)}>{history ? '대화 내용 접기' : '대화 자세히 보기'}<ChevronRight size={16} /></button></div>
      {history && <section className={styles.transcript} aria-label="저장된 대화 내용">{query.data.messages?.length ? query.data.messages.map(message => <div key={message.id} className={`${chatStyles.message} ${message.role === 'user' ? chatStyles.user : chatStyles.assistant}`}>
        {message.role === 'assistant' && <span className={chatStyles.messageAvatar}><Avatar /></span>}<div className={chatStyles.bubble}>{message.text}</div><time className={chatStyles.time}>{message.time}</time>
      </div>) : <p>이 기록에는 대화 원문이 없어요.</p>}{query.data.context.pre !== null && <EmotionSummary primary={query.data.context.primary!} secondary={query.data.context.secondary} situation={query.data.context.slots.OPEN} score={query.data.context.pre} time={dateLabel(query.data.createdAt)} />}</section>}
      <section className={styles.usedToy}><h2>당시 추천 말랑이 · {TOYS[query.data.recommended].name}</h2><Malangi variant={TOYS[query.data.recommended].tint} /><PrimaryLink to={`/malangi?type=${query.data.recommended}`}>말랑이 만나기</PrimaryLink></section><Link className={s.secondary} to="/archive">마음 보관함으로</Link>
    </>}
    {confirm && <Modal title="이 기록을 지울까요?" dismissible={!remove.isPending} onClose={() => { if (!remove.isPending) setConfirm(false); }}><p>이 기록과 대화 내용을 지워요. 삭제한 기록은 되돌릴 수 없어요.</p>{remove.isError && <p className={s.error} role="alert">{remove.error.message}</p>}<div className={s.stack}><button className={`${s.primary} ${s.danger}`} onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending ? '지우고 있어요…' : remove.isError ? '다시 삭제하기' : '기록 지우기'}</button><button className={s.secondary} onClick={() => setConfirm(false)} disabled={remove.isPending}>기록 유지하기</button></div></Modal>}
  </Page>;
}
