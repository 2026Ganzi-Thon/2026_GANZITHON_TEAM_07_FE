import { useEffect, useMemo, useRef, useState } from 'react';
import { registerCustomArtwork, unregisterCustomArtwork } from '../../lib/toyArtwork';
import type { CustomArtworkId } from '../../lib/toyArtwork';
import { forgetToyArtwork } from './toyArtworkLoader';
import { customToyType, deleteCustomWax, INNER_COLORS, readCustomWax, writeCustomWax } from './customWax';
import type { ToyType } from '../../lib/domain';
import { TOYS } from '../../lib/domain';
import type { CustomWax } from './customWax';
import type { ToyDesign } from './designs';

export function useCustomWax() {
  const [items,setItems] = useState<CustomWax[]>([]);
  const [ready,setReady] = useState(false), [error,setError] = useState('');
  const urls = useRef(new Map<CustomArtworkId,string>()), alive = useRef(false);
  function register(item: CustomWax) {
    const url=URL.createObjectURL(item.image); urls.current.set(item.id,url); registerCustomArtwork(item.id,url,customToyType(item));
  }
  useEffect(() => {
    alive.current=true; let cancelled=false;
    void readCustomWax().then(values => {
      if(cancelled)return;
      values.forEach(register);setItems(values);
    }).catch(()=>{if(!cancelled)setError('이 브라우저에서 사진 보관함을 열지 못했어요. 저장 권한을 확인한 뒤 새로고침해 주세요.');})
      .finally(()=>{if(!cancelled)setReady(true);});
    return ()=>{cancelled=true;alive.current=false;for(const [id,url] of urls.current){forgetToyArtwork(id);unregisterCustomArtwork(id);URL.revokeObjectURL(url);}urls.current.clear();};
  },[]);
  useEffect(()=>{
    const keep=new Set(items.map(item=>item.id));
    for(const [id,url] of urls.current)if(!keep.has(id)){forgetToyArtwork(id);unregisterCustomArtwork(id);URL.revokeObjectURL(url);urls.current.delete(id);}
  },[items]);
  async function save(value: CustomWax, replacing?: CustomArtworkId) {
    await writeCustomWax(value,replacing);
    if(!alive.current)return;
    register(value);setItems(previous=>[...previous.filter(item=>item.id!==replacing),value].sort((a,b)=>a.createdAt-b.createdAt));
  }
  async function remove(id: CustomArtworkId) { await deleteCustomWax(id); if(alive.current)setItems(previous=>previous.filter(item=>item.id!==id)); }
  const designs = useMemo(()=>{
    const byType: Record<ToyType,ToyDesign[]> = { SLANGI:[], SQUISHY:[], WAKPPU:[] };
    for (const item of items) {
      const type=customToyType(item);
      byType[type].push({id:item.id,label:`내 ${TOYS[type].name}`,wax:INNER_COLORS[item.color].body,...INNER_COLORS[item.color]});
    }
    return byType;
  },[items]);
  return {items,ready,error,save,remove,designs};
}
