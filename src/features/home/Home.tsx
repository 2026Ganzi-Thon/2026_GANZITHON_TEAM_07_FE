import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowUp } from 'lucide-react';
import { ChatEntrySheet, useChatEntry } from '../chat/ChatEntrySheet';
import { ToySurface } from '../toy/ToySurface';
import { useToyInteraction } from '../toy/useToyInteraction';
import { useToyPreferences } from '../toy/ToyPreferences';
import { previewApi } from '../../lib/api';
import { ToyToolbar, ToyFinish, ToyVariants, ToyStage, toyReturnFrom } from '../toy/ToyChrome';
import { useProfile } from '../../lib/PreviewContext';
import { artworkForType } from '../../lib/recordArtwork';
import { TOYS } from '../../lib/domain';
import type { ToyType } from '../../lib/domain';
import styles from './Home.module.css';

const invitations = ['한 번 눌러보세요!', '살짝 눌러볼까요?', '꾹, 눌러보세요.', '말랑이를 만나보세요!'];
let lastInvitation = -1;
function pickInvitation() {
  const candidates = invitations.map((_, index) => index).filter(index => index !== lastInvitation);
  return invitations[candidates[Math.floor(Math.random() * candidates.length)]];
}

export function Home() {
  const user = useProfile();
  const client = useQueryClient();
  const { audio, choose } = useToyPreferences();
  const location = useLocation(); const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const requested = params.get('play');
  const requestedToy: ToyType | null = requested && Object.hasOwn(TOYS, requested) ? requested as ToyType : null;
  const playing = requestedToy !== null;
  const appliedEntry = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (appliedEntry.current === location.key) return;
    appliedEntry.current = location.key;
    const shape=params.get('shape');
    if (requestedToy && artworkForType(requestedToy,shape)) choose(requestedToy,shape);
  },[location.key,requestedToy,params,choose]);

  const origin = toyReturnFrom(location.state);
  function setPlaying(value: boolean) {
    setParams(value ? { play: active } : {}, { replace: true, state: location.state });
  }
  const [invitation] = useState(pickInvitation);
  useEffect(() => { lastInvitation = invitations.indexOf(invitation); }, [invitation]);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => { const update = () => setHidden(document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  const [open, setOpen] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const entry = useChatEntry();
  const inventory = useQuery({ queryKey: ['preview', user.data?.id, 'inventory'], queryFn: previewApi.inventory, enabled: !!user.data, staleTime: Infinity });
  const [guestToy, setGuestToy] = useState<ToyType>('SQUISHY');
  const active = requestedToy ?? (user.data ? inventory.data?.selected ?? 'SQUISHY' : guestToy);
  const interaction = useToyInteraction(active);
  // Selection is local preview inventory, not an authenticated backend write.
  // Update immediately; serialize persistence so rapid choices cannot finish out of order.
  const selection = useMutation({
    mutationFn: ({ type, owner }: { type: ToyType; owner: string }) => {
      if (client.getQueryData<{ id: string } | null>(['preview', 'me'])?.id !== owner) throw new Error('계정이 바뀌어 이전 선택 저장을 중단했어요.');
      return previewApi.selectToy(type);
    },
    scope: { id: `toy-selection-${user.data?.id}` },
  });
  function select(type: ToyType) {
    if (type === active) return;
    interaction.release(); audio.stop();
    setParams({ play: type }, { replace: true, state: location.state });
    if (user.data && inventory.data) {
      client.setQueryData(['preview', user.data.id, 'inventory'], { ...inventory.data, selected: type });
      selection.mutate({ type, owner: user.data.id });
    } else setGuestToy(type);
  }
  function finishPlay() {
    interaction.release(); audio.stop();
    if (origin.to !== '/') { navigate(origin.to, { state: origin.state, replace: true }); return; }
    setPlaying(false);
    interaction.surface.current?.focus({ preventScroll: true });
  }
  function showChat() { interaction.release(); audio.stop(); setPlaying(false); setOpen(true); }
  return <main className={styles.home} data-playing={playing} aria-label="테슬랑 메인">
    <ToyToolbar active={active} playing={playing} disabled={user.isPending || (!!user.data && !inventory.data)} onSelect={select} onChat={showChat} />
    <ToyStage className={playing ? undefined : styles.content} resting={!playing && !open && !hidden}>
      <div className={styles.characterGroup}>
      <span className={styles.invitation} aria-hidden={playing}><span>{invitation}</span></span>
      <ToySurface active={active} interaction={interaction} playing={playing} className={styles.characterButton} label={playing ? `${TOYS[active].name} 누르기 또는 드래그` : '말랑이 체험하기'} onActivate={() => setPlaying(true)} />
      </div>
    </ToyStage>
    <ToyVariants active={active} playing={playing} />
    {selection.isError && <p className={styles.selectionError} role="alert">{selection.error.message}</p>}
    <ToyFinish playing={playing} onFinish={finishPlay} status={interaction.status} />
    <footer className={styles.footer} inert={playing} aria-hidden={playing}>
      <button className={styles.chatTrigger} aria-haspopup="dialog" aria-controls={open ? 'home-chat-sheet' : undefined} aria-expanded={open}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          swipe.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { swipe.current = null; suppressClick.current = true; }}
        onPointerUp={event => {
          const origin = swipe.current; swipe.current = null;
          if (!origin) return;
          const dx = Math.abs(event.clientX - origin.x); const dy = origin.y - event.clientY;
          suppressClick.current = dx > 12 || Math.abs(dy) > 12;
          if (dy > 40 && dy > dx) { event.currentTarget.focus(); showChat(); }
        }}
        onClick={event => {
          if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
          event.currentTarget.focus(); showChat();
        }}>
        <span className={styles.handle} aria-hidden="true" /><span>테스와 이야기하기 <ArrowUp size={16} aria-hidden="true" /></span>
      </button>
    </footer>
    {open && <ChatEntrySheet id="home-chat-sheet" entry={entry} onClose={() => setOpen(false)} />}
  </main>;
}
