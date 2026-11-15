import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Check, ChevronDown, RotateCcw, Settings, X } from 'lucide-react';
import { Avatar, IconButton, Modal } from '../../components/ui';
import { BottomSheet } from '../../components/BottomSheet';
import { ToySurface } from '../toy/ToySurface';
import { useToyInteraction } from '../toy/useToyInteraction';
import { SoundButton, SoundSettings, ToyDesignPicker, useToyPreferences } from '../toy/ToyPreferences';
import { previewApi } from '../../lib/api';
import { AppMenu } from '../../components/AppMenu';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import { TOYS } from '../../lib/domain';
import type { ToyType } from '../../lib/domain';
import toyStyles from '../toy/Toy.module.css';
import styles from './Home.module.css';

export function Home() {
  const user = useProfile(); const preview = usePreview();
  const client = useQueryClient();
  const { audio } = useToyPreferences();
  const [playing, setPlaying] = useState(false);
  const [picker, setPicker] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => preview.entry?.text ?? '');
  const navigate = useNavigate();
  useEffect(() => { preview.entry = null; }, [preview]);
  const inventory = useQuery({ queryKey: ['preview', user.data?.id, 'inventory'], queryFn: previewApi.inventory, enabled: !!user.data, staleTime: Infinity });
  const [guestToy, setGuestToy] = useState<ToyType>('SLANGI');
  const active = user.data ? inventory.data?.selected ?? 'SLANGI' : guestToy;
  const interaction = useToyInteraction(active);
  const selection = useMutation({ mutationFn: previewApi.selectToy, onSuccess: data => {
    client.setQueryData(['preview', user.data?.id, 'inventory'], data); setPicker(false);
  } });
  function finishPlay() {
    interaction.release(); audio.stop(); setPlaying(false);
    interaction.surface.current?.focus({ preventScroll: true });
  }
  function showChat() { interaction.release(); audio.stop(); setPlaying(false); setOpen(true); }
  function startChat() {
    preview.entry = draft.trim() ? { text: draft.trim() } : null;
    navigate('/chat');
  }
  return <main className={styles.home} data-playing={playing} aria-label="테슬랑 메인">
    <header className={styles.header}><IconButton label="MY 및 설정" onClick={() => navigate('/settings')}><Settings size={21} strokeWidth={1.5} /></IconButton></header>
    <div className={styles.playControls} inert={!playing} aria-hidden={!playing}>
      <button className={styles.typeSelect} disabled={user.isPending || (!!user.data && inventory.isPending)} onClick={event => { event.currentTarget.focus(); setPicker(true); }} aria-haspopup="dialog">{TOYS[active].name}<ChevronDown size={16} aria-hidden="true" /></button>
      <div className={styles.playActions}><SoundButton /><IconButton label="말랑이 체험 마치기" onClick={finishPlay}><X size={19} /></IconButton></div>
    </div>
    <div className={styles.content}>
      <ToySurface active={active} interaction={interaction} playing={playing} className={styles.characterButton} label={playing ? `${TOYS[active].name} 누르기 또는 드래그` : '말랑이 체험하기'} onActivate={() => setPlaying(true)} />
    </div>
    <div className={styles.playReset} inert={!playing} aria-hidden={!playing}>
      <button onClick={interaction.reset}><RotateCcw size={16} aria-hidden="true" />처음 모양으로</button>
      <span role="status" className={styles.srOnly}>{playing ? interaction.status : ''}</span>
    </div>
    <div className={styles.menuDock}><AppMenu onChat={showChat} /></div>
    {picker && <Modal title="함께 쉴 말랑이" dismissible={!selection.isPending} onClose={() => { if (!selection.isPending) setPicker(false); }}>
      <div className={toyStyles.options}>{(Object.keys(TOYS) as ToyType[]).map(type => <button key={type} disabled={selection.isPending || (!!user.data && inventory.isError)}
        onClick={() => { if (user.data) selection.mutate(type); else { setGuestToy(type); setPicker(false); } }} aria-pressed={active === type}>
        <span><strong>{TOYS[type].name}</strong><small>선택 가능</small></span>
        {active === type ? <Check size={18} /> : null}
      </button>)}</div>
      <ToyDesignPicker active={active} disabled={selection.isPending} />
      <SoundSettings />
      {inventory.isError && <div role="alert"><p>말랑이 목록을 불러오지 못했어요.</p><button className={styles.retry} onClick={() => inventory.refetch()}>다시 불러오기</button></div>}
      {selection.isError && <p role="alert">{selection.error.message}</p>}
      {selection.isPending && <p role="status">말랑이를 바꾸고 있어요.</p>}
    </Modal>}
    {open && <BottomSheet id="home-chat-sheet" title="테스와 이야기하기" onClose={() => setOpen(false)}>
      <form className={styles.chatEntry} onSubmit={event => { event.preventDefault(); startChat(); }}>
        <div className={styles.tess}><Avatar /><span>테스</span></div>
        <textarea aria-label="첫 이야기" placeholder="어떤 일이 있었나요?" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={3} />
        <button type="submit" className={styles.begin}>대화 시작하기 <ArrowUp size={18} aria-hidden="true" /></button>
      </form>
    </BottomSheet>}
  </main>;
}
