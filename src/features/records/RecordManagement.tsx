import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { ErrorState, Page, Pending } from '../../components/Page';
import { previewApi } from '../../lib/api';
import { useProfile } from '../../lib/PreviewContext';
import { dateLabel, type DiaryRecord } from '../../lib/domain';
import s from '../../components/Page.module.css';
import styles from './Records.module.css';

export function RecordManagement() {
  const user = useProfile(); const client = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'hidden'>('all');
  const [notice, setNotice] = useState('');
  const key = ['preview', user.data!.id];
  const query = useQuery({ queryKey: [...key, 'records'], queryFn: () => previewApi.records() });
  const visibility = useMutation({ mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => previewApi.setRecordHidden(id, hidden), onSuccess: async record => {
    await client.cancelQueries({ queryKey: [...key, 'records'] });
    client.setQueryData([...key, 'record', record.id], record);
    client.setQueryData<DiaryRecord[]>([...key, 'records'], previous => previous?.map(item => item.id === record.id ? record : item));
    await client.invalidateQueries({ queryKey: [...key, 'records'] });
    setNotice(record.hidden ? '기록을 가렸어요.' : '기록을 다시 표시했어요.');
  } });
  const records = (query.data ?? []).filter(record => filter === 'all' || record.hidden);
  return <Page title="기록 관리" back="/settings">
    <p className={s.small}>가린 기록은 마음 보관함의 달력·목록·요약에서 제외돼요. 이곳에서 다시 표시할 수 있어요.</p>
    <div className={styles.managementTabs} role="group" aria-label="관리할 기록">{(['all', 'hidden'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? '전체 기록' : '가린 기록'}</button>)}</div>
    <p role="status" className={s.small}>{notice}</p>
    {visibility.isError && <p role="alert" className={s.error}>{visibility.error.message} 기록 상태는 바뀌지 않았어요. 다시 눌러주세요.</p>}
    {query.isPending ? <Pending /> : query.isError ? <ErrorState message={query.error.message} retry={() => query.refetch()} /> : records.length ? records.map(record => <section className={styles.recordCard} key={record.id} aria-label={`${dateLabel(record.createdAt)} 기록 관리`}>
      <span className={styles.recordMeta}>{dateLabel(record.createdAt)}{record.partial ? ' · 중간 보관' : ''}</span>
      <h2 className={styles.recordSummary}>{record.hidden ? '가려 둔 기록' : record.summary}</h2>
      <div className={styles.manageActions}><button disabled={visibility.isPending} onClick={() => visibility.mutate({ id: record.id, hidden: !record.hidden })}>{record.hidden ? <Eye size={16} /> : <EyeOff size={16} />}{record.hidden ? '다시 표시하기' : '기록 가리기'}</button><Link to={`/records/${record.id}?manage=1`}>상세 / 삭제</Link></div>
    </section>) : <p className={s.empty}>{filter === 'hidden' ? '가린 기록이 없어요.' : '아직 보관한 기록이 없어요.'}</p>}
  </Page>;
}
