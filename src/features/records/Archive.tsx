import { SettingsLink } from '../../components/SettingsLink';
import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Heart, Settings } from 'lucide-react';
import { ErrorState, Page, Pending, PrimaryLink } from '../../components/Page';
import { IconButton } from '../../components/ui';
import { previewApi } from '../../lib/api';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import { localDate, TOYS } from '../../lib/domain';
import { emotionPresentation, newestFirst, presentEmotion, weekDates, weeklySummary } from './archiveModel';
import s from '../../components/Page.module.css';
import styles from './Archive.module.css';
import { RecordManagement } from './RecordManagement';

export function Archive() {
  const [params] = useSearchParams();
  return params.get('manage') === '1' ? <RecordManagement /> : <ArchiveContent />;
}
function ArchiveContent() {
  const location = useLocation();
  const user = useProfile(); const preview = usePreview();
  const restored = location.state?.archiveView;
  const restoreDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value + 'T12:00:00').getTime()) ? new Date(value + 'T12:00:00') : new Date();
  const [month, setMonth] = useState(() => { const date = restoreDate(restored?.month); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const [selected, setSelected] = useState(() => localDate(restoreDate(restored?.selected)));
  const [view, setView] = useState<'month' | 'week' | 'list'>(() => restored?.view === 'week' || restored?.view === 'list' ? restored.view : 'month');
  const query = useQuery({ queryKey: ['preview', user.data!.id, 'records'], queryFn: () => { const fail = preview.faults.list; preview.faults.list = false; return previewApi.records(fail); } });
  const records = newestFirst((query.data ?? []).filter(record => !record.hidden));
  const daily = records.filter(record => localDate(record.createdAt) === selected);
  const monthly = records.filter(record => localDate(record.createdAt).slice(0, 7) === localDate(month).slice(0, 7));
  const week = weekDates(selected); const summary = weeklySummary(records, selected);
  const dates = Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1, 12));
  const entriesFor = (date: Date) => records.filter(record => localDate(record.createdAt) === localDate(date));
  function select(date: Date) { setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelected(localDate(date)); }
  function move(delta: number) {
    select(view === 'week' ? new Date(week[0].getFullYear(), week[0].getMonth(), week[0].getDate() + delta * 7, 12) : new Date(month.getFullYear(), month.getMonth() + delta, 1, 12));
  }
  const visible = view === 'list' ? monthly : daily;
  const emotionRecords = monthly.filter(record => record.context.primary !== null);
  const frequency = Object.entries(emotionRecords.reduce<Record<string, number>>((result, record) => { const key = record.context.primary!; result[key] = (result[key] ?? 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]);
  const legend = [...new Set(['불안', '분노', '서운함', '슬픔', ...emotionRecords.map(record => record.context.primary!)])];
  return <Page title="마음 보관함" titlePlacement="body" className={styles.page} action={<SettingsLink returnState={{ archiveView: { month: localDate(month), selected, view } }}><Settings size={21} /></SettingsLink>}>
    {location.state?.saved && <p role="status" className={styles.caption}>여기까지 나눈 이야기를 보관했어요.</p>}
    <p className={styles.caption}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} · {query.data ? `기록 ${records.length}개` : query.isError ? '기록 수 확인 불가' : '기록 불러오는 중'}</p>
    {query.isPending ? <Pending>기록을 불러오고 있어요.</Pending> : query.isError ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : <>
      <div className={styles.tabs} role="group" aria-label="기록 보기 방식">{([['month', '월간'], ['week', '주간'], ['list', '목록']] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div>
      <div className={styles.period}>
        <IconButton label={view === 'week' ? '이전 주' : '이전 달'} onClick={() => move(-1)}><ChevronLeft size={16} /></IconButton>
        <h2 aria-live="polite">{view === 'week' ? `${week[0].getFullYear()}년 ${week[0].getMonth() + 1}.${week[0].getDate()} – ${week[6].getMonth() + 1}.${week[6].getDate()}` : `${month.getFullYear()}년 ${month.getMonth() + 1}월`}</h2>
        <IconButton label={view === 'week' ? '다음 주' : '다음 달'} onClick={() => move(1)}><ChevronRight size={16} /></IconButton>
        <button className={styles.today} onClick={() => select(new Date())}>오늘</button>
      </div>
      {view === 'month' && <section className={styles.calendar} aria-label="월간 기록 달력">
        <div className={styles.grid}>{['일', '월', '화', '수', '목', '금', '토'].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
          {Array.from({ length: month.getDay() }, (_, index) => <span key={`blank-${index}`} />)}
          {dates.map(date => { const key = localDate(date); const entries = entriesFor(date); return <button key={key} aria-label={`${key}, 기록 ${entries.length}개`} aria-pressed={selected === key} aria-current={key === localDate(new Date()) ? 'date' : undefined} onClick={() => select(date)}>{date.getDate()}<span className={styles.dots} aria-hidden="true">{[...new Set(entries.map(record => record.context.primary))].slice(0, 3).map(emotion => <i key={emotion ?? '기타'} style={{ background: presentEmotion(emotion).color }} />)}</span></button>; })}
        </div>
        <div className={styles.legend}>{legend.map(emotion => <span key={emotion}><i style={{ background: presentEmotion(emotion).color }} />{emotion}</span>)}</div>
      </section>}
      {view === 'week' && <section className={styles.week} aria-label="주간 기록 달력">
        <div className={styles.weekGrid}>{week.map((date, index) => { const entries = entriesFor(date); const key = localDate(date); return <button key={key} aria-label={`${key}, 기록 ${entries.length}개${entries.length ? `, 최근 감정 ${entries[0].context.primary ?? '미선택'}` : ''}`} aria-pressed={selected === key} aria-current={key === localDate(new Date()) ? 'date' : undefined} onClick={() => select(date)}>
          <span>{['월', '화', '수', '목', '금', '토', '일'][index]}</span>
          <span className={styles.weekEmotion} data-empty={!entries.length} aria-hidden="true">{entries.length ? presentEmotion(entries[0].context.primary).emoji : ''}{entries.length > 1 && <small className={styles.badge}>{entries.length}</small>}</span>
          <span>{date.getDate()}</span>
        </button>; })}</div>
        <div className={styles.weekSummary} aria-label="주간 요약"><span>이번 주 <strong>{summary.count}회</strong> 기록</span><span title={`전후 점수를 모두 남긴 ${summary.pairedCount}개 기록 기준`}>평균 강도 <strong>{summary.pre?.toFixed(1) ?? '—'} → {summary.post?.toFixed(1) ?? '—'}</strong></span></div>
      </section>}
      <section aria-label="선택 날짜 기록">
        <h2 className={styles.dayTitle}>{view === 'list' ? `${month.getMonth() + 1}월 기록` : `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일의 마음`} <span>{visible.length}</span></h2>
        {visible.length ? <div className={styles.recordList}>{visible.map(record => {
          const date = new Date(record.createdAt);
          return <Link key={record.id} to={`/records/${record.id}`}>
            <span className={styles.listEmoji} aria-hidden="true">{presentEmotion(record.context.primary).emoji}</span>
            <div className={styles.listContent}><div className={styles.meta}><strong>{record.context.primary ?? '마음 기록'}</strong><time dateTime={record.createdAt}>{date.getMonth() + 1}.{date.getDate()} {date.toLocaleDateString('ko-KR', { weekday: 'short' })} · {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</time></div>
              <p className={styles.summary}>{record.summary}</p><p className={styles.score}>강도 {record.context.pre ?? '—'} → {record.context.post ?? '—'} · {record.recommended ? TOYS[record.recommended].name : '중간 보관'}</p></div>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>;
        })}</div> : <div className={s.empty}><Heart size={28} strokeWidth={1.2} /><h2>{records.length ? (view === 'list' ? '이달 남긴 기록이 없어요' : '이날 남긴 기록이 없어요') : '아직 기록이 없어요'}</h2><p>테스와 이야기하고 마음을 남겨보세요.</p><PrimaryLink to="/chat">마음 이야기하기</PrimaryLink></div>}
      </section>
      {view === 'month' && frequency.length > 0 && <section className={styles.frequency} aria-label="월간 감정 기록 횟수"><h2>{month.getMonth() + 1}월 돌아보기</h2><p>대표 감정별 기록 횟수</p>{frequency.map(([emotion, count]) => <div key={emotion}><span>{emotion}</span><span className={styles.track}><i style={{ width: `${count / emotionRecords.length * 100}%`, background: emotionPresentation[emotion]?.color ?? '#868079' }} /></span><small>{count}회</small></div>)}</section>}
    </>}
  </Page>;
}
