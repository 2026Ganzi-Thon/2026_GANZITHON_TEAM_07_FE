import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryRecord, ToyType } from './domain';
import { readRecordArtwork, rememberRecordArtwork, forgetRecordArtwork } from './recordArtwork';

const record=(id:string,type:ToyType,createdAt='2026-11-20T00:00:00Z')=>({id,recommended:type,createdAt} as DiaryRecord);
beforeEach(()=>{const map=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)});});
describe('record artwork identity',()=>{
 it('keeps every supplied shape fixed per record instead of following later preferences',()=>{
  const groups:Record<ToyType,string[]>={SLANGI:['slime-lavender','slime-mint','slime-pink'],SQUISHY:['sheep','pudding-squishy','dumpling'],WAKPPU:['butter','heart','wax-cloud']};
  for(const [type,shapes] of Object.entries(groups))for(const shape of shapes){
   const r=record(shape,type as ToyType);expect(rememberRecordArtwork('all',r,shape)).toBe(shape);
   expect(rememberRecordArtwork('all',r,shapes[0])).toBe(shape);expect(readRecordArtwork('all',r)).toBe(shape);
   forgetRecordArtwork('all',r);expect(readRecordArtwork('all',r)).toBeUndefined();
  }
 });
 it('isolates account and reused record IDs and rejects a mismatched category',()=>{
  const r=record('77','SQUISHY');rememberRecordArtwork('owner-a',r,'dumpling');
  expect(readRecordArtwork('owner-b',r)).toBeUndefined();expect(readRecordArtwork('owner-a',{...r,createdAt:'2026-11-21T00:00:00Z'})).toBeUndefined();
  expect(rememberRecordArtwork('owner-b',r,'heart')).toBeUndefined();
 });
 it('retains metadata in the current tab when browser storage is denied',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('denied');},setItem:()=>{throw new Error('denied');}});
  const r=record('blocked-storage','WAKPPU');expect(rememberRecordArtwork('owner-c',r,'heart')).toBe('heart');expect(readRecordArtwork('owner-c',r)).toBe('heart');
 });
});
