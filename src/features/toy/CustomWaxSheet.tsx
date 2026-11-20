import { useEffect, useRef, useState } from 'react';
import { Plus, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui';
import { getArtwork } from '../../lib/toyArtwork';
import type { CustomArtworkId } from '../../lib/toyArtwork';
import { useToyPreferences } from './ToyPreferences';
import { DEFAULT_CROP, INNER_COLORS, MAX_CUSTOM_WAX } from './customWax';
import type { CustomWax, WaxCrop } from './customWax';
import { drawWaxPhoto, photoBounds, pngBlob, prepareWaxPhoto, readWaxImage } from './customWaxImage';
import styles from './CustomWax.module.css';

export function CustomWaxSheet({onClose}:{onClose:()=>void}) {
  const {custom,choose,designs}=useToyPreferences();
  const [editing,setEditing]=useState<CustomWax | 'new' | null>(custom.items.length ? null : 'new');
  const [deleting,setDeleting]=useState<CustomArtworkId | null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function remove(id:CustomArtworkId) {
    setBusy(true);setError('');
    try {await custom.remove(id);if(designs.WAKPPU===id)choose('WAKPPU','butter');setDeleting(null);}
    catch(e){setError(e instanceof Error?e.message:'삭제하지 못했어요.');}finally{setBusy(false);}
  }
  return <div className={styles.dialogScope}><Modal title={editing ? '내 왁뿌볼 만들기' : '내 왁뿌볼'} onClose={onClose} dismissible={!busy}>
    <div className={styles.sheet}>
      {editing ? <WaxEditor key={typeof editing==='string'?editing:editing.id} existing={editing==='new'?undefined:editing} onBusy={setBusy} onCancel={()=>custom.items.length?setEditing(null):onClose()} onSaved={onClose} /> : <>
        <p className={styles.note}>사진 속 모습을 톡톡 깨뜨리고, 안쪽의 말랑함을 만나보세요.</p>
        <div className={styles.collection}>
          {custom.items.map((item,i)=><div key={item.id} className={styles.item}>
            <button className={styles.thumbnail} aria-label={`내 왁뿌볼 ${i+1} 선택`} aria-pressed={designs.WAKPPU===item.id} disabled={busy} onClick={()=>{choose('WAKPPU',item.id);onClose();}}><img src={getArtwork(item.id).src} alt="" /></button>
            <div className={styles.itemActions}><button aria-label={`내 왁뿌볼 ${i+1} 수정`} disabled={busy} onClick={()=>setEditing(item)}><Pencil size={16}/></button><button aria-label={`내 왁뿌볼 ${i+1} 삭제`} disabled={busy} onClick={()=>setDeleting(item.id)}><Trash2 size={16}/></button></div>
            {deleting===item.id&&<div className={styles.confirm}><p>이 사진 말랑이를 지울까요?</p><button disabled={busy} onClick={()=>setDeleting(null)}>취소</button><button disabled={busy} onClick={()=>void remove(item.id)}>삭제하기</button></div>}
          </div>)}
          <button className={styles.add} disabled={busy||custom.items.length>=MAX_CUSTOM_WAX} onClick={()=>setEditing('new')}><Plus size={24}/><span>새로 만들기</span></button>
        </div>
      </>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
    </div>
  </Modal></div>;
}

function WaxEditor({existing,onBusy,onCancel,onSaved}:{existing?:CustomWax;onBusy:(v:boolean)=>void;onCancel:()=>void;onSaved:()=>void}) {
  const {custom,choose}=useToyPreferences();
  const [photo,setPhoto]=useState<{blob:Blob;image:HTMLImageElement;bounds:ReturnType<typeof photoBounds>}|null>(null);
  const [crop,setCrop]=useState<WaxCrop>(existing?.crop??DEFAULT_CROP),[color,setColor]=useState(existing?.color??0);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null), file=useRef<HTMLInputElement>(null), generation=useRef(0);
  useEffect(()=>{
    let cancelled=false;
    if(existing){setLoading(true);void readWaxImage(existing.source).then(image=>{if(!cancelled)setPhoto({blob:existing.source,image,bounds:photoBounds(image)});}).catch(()=>{if(!cancelled)setError('사진을 열지 못했어요. 다른 사진을 골라 주세요.');}).finally(()=>{if(!cancelled)setLoading(false);});}
    return ()=>{cancelled=true;generation.current++;};
  },[existing]);
  useEffect(()=>{if(photo&&canvas.current)drawWaxPhoto(canvas.current,photo.image,crop,photo.bounds);},[photo,crop]);
  async function pick(value:File) {
    const ticket=++generation.current;setLoading(true);setError('');
    try {
      const blob=await prepareWaxPhoto(value),image=await readWaxImage(blob),bounds=photoBounds(image);
      if(ticket!==generation.current)return;
      setPhoto({blob,image,bounds});setCrop({...DEFAULT_CROP,mode:bounds.transparent?'outline':'circle'});
    }catch(e){if(ticket===generation.current)setError(e instanceof Error?e.message:'사진을 열지 못했어요.');}
    finally{if(ticket===generation.current)setLoading(false);}
  }
  async function save() {
    if(!photo||!canvas.current||saving||loading)return;
    setSaving(true);onBusy(true);setError('');
    try {
      const image=await pngBlob(canvas.current);
      const value:CustomWax={id:`custom-${crypto.randomUUID()}`,source:photo.blob,image,crop,color,createdAt:existing?.createdAt??Date.now()};
      await custom.save(value,existing?.id);choose('WAKPPU',value.id);onSaved();
    }catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요.');}
    finally{setSaving(false);onBusy(false);}
  }
  return <>
    <p className={styles.note}>사진이 왁스가 되고, 깨질수록 안쪽 색이 드러나요.</p>
    <input ref={file} className={styles.file} type="file" accept="image/jpeg,image/png,image/webp" aria-label="왁뿌볼 사진" disabled={saving} onChange={e=>{const value=e.currentTarget.files?.[0];e.currentTarget.value='';if(value)void pick(value);}}/>
    <button type="button" className={styles.preview} disabled={loading||saving} onClick={()=>file.current?.click()} aria-label={photo?'사진 바꾸기':'사진 고르기'}>
      <canvas ref={canvas} hidden={!photo} aria-hidden="true"/>
      {!photo&&<span><ImagePlus size={32}/><span>사진 고르기</span><small>JPG · PNG · WebP</small></span>}
      {loading&&<span className={styles.loading} role="status">사진을 준비하고 있어요…</span>}
      {photo&&!loading&&<span className={styles.change}>사진 바꾸기</span>}
    </button>
    {photo&&<fieldset disabled={saving||loading} className={styles.controls}>
      <legend className="sr-only">사진과 안쪽 색 설정</legend>
      <label>형태</label>
      <div className={styles.segment}><button aria-pressed={crop.mode==='circle'} onClick={()=>setCrop({...crop,mode:'circle'})}>둥근 형태</button><button aria-pressed={crop.mode==='outline'} disabled={!photo.bounds.transparent} onClick={()=>setCrop({...crop,mode:'outline'})}>사진 윤곽</button></div>
      {!photo.bounds.transparent&&<p className={styles.hint}>사진 윤곽은 배경이 투명한 이미지에서 사용할 수 있어요.</p>}
      {crop.mode==='circle'&&<div className={styles.sliders}>
        <label>확대<input aria-label="사진 확대" type="range" min="1" max="2.5" step="0.01" value={crop.zoom} onChange={e=>setCrop({...crop,zoom:Number(e.target.value)})}/></label>
        <label>좌우<input aria-label="사진 좌우 위치" type="range" min="-1" max="1" step="0.01" value={crop.x} onChange={e=>setCrop({...crop,x:Number(e.target.value)})}/></label>
        <label>위아래<input aria-label="사진 위아래 위치" type="range" min="-1" max="1" step="0.01" value={crop.y} onChange={e=>setCrop({...crop,y:Number(e.target.value)})}/></label>
      </div>}
      <label>안쪽 색 <span className={styles.colorName}>{INNER_COLORS[color].name}</span></label>
      <div className={styles.colors}>{INNER_COLORS.map((c,i)=><button key={c.name} aria-label={c.name} aria-pressed={color===i} onClick={()=>setColor(i)} style={{background:c.body}}>{color===i?'✓':''}</button>)}</div>
    </fieldset>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.footer}><button className={styles.cancel} disabled={saving} onClick={onCancel}>취소</button><button className={styles.submit} disabled={!photo||loading||saving} onClick={()=>void save()}>{saving?'저장 중…':existing?'저장하고 만지기':'만들고 만지기'}</button></div>
  </>;
}
