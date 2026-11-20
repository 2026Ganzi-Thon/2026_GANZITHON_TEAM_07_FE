import { describe, expect, it } from 'vitest';
import { validCustomWax, DEFAULT_CROP, customToyType, restorePhoto } from './customWax';
import { artworkMaterial, deformArtwork } from './artworkDeformation';
import type { CustomWax } from './customWax';
import { registerCustomArtwork, unregisterCustomArtwork } from '../../lib/toyArtwork';
import { configureShell, createToyModel, hitShell, shellCellAt, hasShell, pressToy, releaseToy, stepToy } from './physics';

const id = 'custom-12345678-1234-1234-1234-123456789abc' as const;
const sample:CustomWax = {id,source:new Blob(['image'],{type:'image/png'}),image:new Blob(['wax'],{type:'image/png'}),crop:DEFAULT_CROP,color:0,createdAt:1};
describe('custom wax persistence boundary',()=>{
  it('keeps legacy wax records and rejects unknown types or invalid manual masks',()=>{
    expect(customToyType(sample)).toBe('WAKPPU');
    for(const toyType of ['SLANGI','SQUISHY','WAKPPU'] as const)expect(validCustomWax({...sample,toyType})).toBe(true);
    expect(validCustomWax({...sample,toyType:'other'})).toBe(false);
    const old = {...sample,crop:{...DEFAULT_CROP,mode:'manual',points:[{x:0,y:0},{x:1,y:0},{x:.5,y:1}]}};
    expect(validCustomWax(old)).toBe(false);
    const restored = restorePhoto(old) as CustomWax;
    expect(validCustomWax(restored)).toBe(true);expect(restored.crop.mode).toBe('outline');
    expect(restored.image).toBe(sample.image);expect(restored.source).toBe(sample.image);
    expect(validCustomWax({...sample,crop:{...DEFAULT_CROP,mode:'manual',points:[]}})).toBe(false);
  });
  it('accepts only bounded photo blobs and supported crop/color settings',()=>{
    expect(validCustomWax(sample)).toBe(true);
    for(const invalid of [{...sample,color:90},{...sample,id:'heart'},{...sample,image:'https://example.com/image.png'},{...sample,source:new Blob(['<svg/>'],{type:'image/svg+xml'})},{...sample,crop:{...DEFAULT_CROP,zoom:NaN}},{...sample,crop:{...DEFAULT_CROP,x:3}}])expect(validCustomWax(invalid)).toBe(false);
  });
});
describe('custom material routing',()=>{
  for(const type of ['SLANGI','SQUISHY','WAKPPU'] as const)it(`${type} uses its own material without copying sheep facial animation`,()=>{
    registerCustomArtwork(id,'blob:unit-fixture',type);
    try {
      const reference=type==='SLANGI'?'slime-lavender':type==='SQUISHY'?'sheep':'butter';
      expect(artworkMaterial(id)).toEqual(artworkMaterial(reference));
      const model=createToyModel(type,id);model.hitTest=()=>true;
      pressToy(model,{x:150,y:145},0);stepToy(model,.1,100);
      if(type!=='WAKPPU'){expect(model.cracks).toBe(0);expect(model.opacity).toBeGreaterThan(0);}
      if(type==='SQUISHY')expect(deformArtwork({x:165,y:155},{anchor:{x:150,y:145},pull:{x:0,y:0},depth:1,shape:id})).not.toEqual(deformArtwork({x:165,y:155},{anchor:{x:150,y:145},pull:{x:0,y:0},depth:1,shape:'sheep'}));
    } finally {unregisterCustomArtwork(id);}
  });
});
describe('custom silhouette shell',()=>{
  for(const [label,hit] of [
    ['circle',(x:number,y:number)=>Math.hypot(x-150,y-145)<105],
    ['thin',(x:number,y:number)=>x>146&&x<154&&y>35&&y<255],
    ['detached small detail',(x:number,y:number)=>Math.hypot(x-150,y-155)<65 || Math.hypot(x-240,y-40)<5],
  ] as const)it(`${label}: all remaining cells are reachable and restore after breaking`,()=>{
    registerCustomArtwork(id,'blob:unit-fixture');
    try {
      const m=createToyModel('WAKPPU',id);m.hitTest=p=>hit(p.x,p.y);configureShell(m,m.hitTest);
      expect(m.shards.length).toBeGreaterThan(0);
      for(const cell of m.shards){
        let point:{x:number;y:number}|undefined;
        for(let y=1.5;y<290&&!point;y+=3)for(let x=1.5;x<300;x+=3)if(hit(x,y)&&shellCellAt(m,{x,y})===cell){point={x,y};break;}
        expect(point).toBeDefined();
        expect(hitShell(m,point!,0)).toBe(true);expect(hitShell(m,point!,1)).toBe(false);
      }
      expect(hasShell(m)).toBe(false);pressToy(m,{x:150,y:145},100);stepToy(m,.5,600);expect(m.opacity).toBeGreaterThan(0);releaseToy(m,600);
      for(let now=616;now<7000;now+=16)stepToy(m,.016,now);
      expect(m.shellCycles).toBe(1);expect(hasShell(m)).toBe(true);
    }finally{unregisterCustomArtwork(id);}
  });
});
