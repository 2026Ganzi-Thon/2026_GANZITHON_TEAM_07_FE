import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowUp } from 'lucide-react';
import { Avatar } from '../../components/ui';
import { BottomSheet } from '../../components/BottomSheet';
import { usePreview } from '../../lib/PreviewContext';
import styles from './ChatEntrySheet.module.css';

export function useChatEntry() {
  const preview = usePreview();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => preview.entry?.text ?? '');
  useEffect(() => { preview.entry = null; }, [preview]);
  function start() {
    preview.entry = draft.trim() ? { text: draft.trim() } : null;
    navigate('/chat');
  }
  return { draft, setDraft, start };
}

export function ChatEntrySheet({ id, entry, onClose }: {
  id: string; entry: ReturnType<typeof useChatEntry>; onClose: () => void;
}) {
  return <BottomSheet id={id} title="테스와 이야기하기" onClose={onClose}>
    <form className={styles.chatEntry} onSubmit={event => { event.preventDefault(); entry.start(); }}>
      <div className={styles.tess}><Avatar /><span>테스</span></div>
      <textarea aria-label="첫 이야기" placeholder="어떤 일이 있었나요?" value={entry.draft} onChange={event => entry.setDraft(event.target.value)} maxLength={2000} rows={3} />
      <button type="submit" className={styles.begin}>대화 시작하기 <ArrowUp size={18} aria-hidden="true" /></button>
    </form>
  </BottomSheet>;
}
