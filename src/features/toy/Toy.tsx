import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, RotateCcw, Settings } from 'lucide-react';
import { AppMenu } from '../../components/AppMenu';
import { ToySurface } from './ToySurface';
import { useToyInteraction } from './useToyInteraction';
import { SoundButton, SoundSettings, ToyDesignPicker } from './ToyPreferences';
import { Modal } from '../../components/ui';
import { ErrorState, Pending } from '../../components/Page';
import { previewApi } from '../../lib/api';
import { useProfile } from '../../lib/PreviewContext';
import { TOYS } from '../../lib/domain';
import type { ToyType } from '../../lib/domain';
import s from '../../components/Page.module.css';
import styles from './Toy.module.css';
export function Toy() {
  const user = useProfile(); const client = useQueryClient(); const [params, setParams] = useSearchParams();
  const key = ['preview', user.data!.id, 'inventory'];
  const inventory = useQuery({ queryKey: key, queryFn: previewApi.inventory });
  const [open, setOpen] = useState(false);
  const requested = params.get('type') as ToyType | null;
  const active = requested && Object.hasOwn(TOYS, requested) ? requested : inventory.data?.selected ?? 'SLANGI';
  const toy = TOYS[active];
  const interaction = useToyInteraction(active);
  const selection = useMutation({ mutationFn: previewApi.selectToy, onSuccess: data => { client.setQueryData(key, data); setParams({ type: data.selected }, { replace: true }); setOpen(false); } });
  return <main className={styles.page}><header className={styles.header}><Link to="/" aria-label="메인으로"><ArrowLeft size={21} /></Link><span /><Link to="/settings" aria-label="MY 및 설정"><Settings size={21} /></Link></header>
    {inventory.isPending ? <Pending /> : inventory.isError ? <ErrorState message={inventory.error.message} retry={() => inventory.refetch()} /> : <>
    <button className={styles.select} onClick={e => { e.currentTarget.focus(); setOpen(true); }}>{toy.name}<ChevronDown size={16} /></button>
    <section className={styles.center}><h1 className="sr-only">{toy.name}{active === 'WAKPPU' ? '과' : '와'} 쉬어가요.</h1><p className="sr-only">{toy.instruction}</p>
      <ToySurface active={active} interaction={interaction} />
      <p role="status" className="sr-only">{interaction.status}</p>
      <button className={styles.reset} onClick={interaction.reset}><RotateCcw size={14} />처음 모양으로</button>
    </section><footer className={styles.footer}><SoundButton /><AppMenu /></footer>
    {open && <Modal title="함께 쉴 말랑이" dismissible={!selection.isPending} onClose={() => { if (!selection.isPending) setOpen(false); }}><div className={styles.options}>{(Object.keys(TOYS) as ToyType[]).map(type => <button key={type} disabled={selection.isPending} onClick={() => selection.mutate(type)} aria-pressed={active === type}><span><strong>{TOYS[type].name}</strong><small>선택 가능</small></span>{active === type ? <Check size={18} /> : null}</button>)}</div><ToyDesignPicker active={active} disabled={selection.isPending} /><SoundSettings />{selection.isError && <p role="alert" className={s.error}>{selection.error.message}</p>}{selection.isPending && <p role="status">말랑이를 바꾸고 있어요.</p>}</Modal>}
    </>}
  </main>;
}
