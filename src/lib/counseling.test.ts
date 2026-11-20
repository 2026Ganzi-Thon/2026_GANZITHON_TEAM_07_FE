import { localDate } from './domain';
import { afterEach, expect, it, vi } from 'vitest';
import { decodeTurn, decodeServerRecord, decodeMessages, decodeCompletionId } from './counselingContracts';
import { serverRecords } from './recordsApi';
import { authSession } from './authSession';
const turn = { sessionId:1,status:'IN_PROGRESS',currentStep:'STEP_02',aiMessage:null,riskDetected:false,replyOptions:[],nextInput:'MESSAGE',emotionCard:null };
const record = { resultId:4,createdAt:'2026-11-20T01:00:00Z',summary:'기록',primaryEmotion:'불안함',secondaryEmotion:null,preIntensity:7,postIntensity:0,recommendedMalangi:'SLANGI',hidden:false };
afterEach(() => { authSession.clear('signed-out'); vi.unstubAllGlobals(); });
it('preserves null emotion acknowledgement and requires known input states',()=>{
 expect(decodeTurn(turn).aiMessage).toBeNull();
 expect(()=>decodeTurn({...turn,nextInput:'AUTOCOMPLETE'})).toThrow();
 expect(()=>decodeTurn({...turn,nextInput:'EMOTION_CARD'})).toThrow();
 expect(()=>decodeTurn({...turn,sessionId:'1'})).toThrow();
});
it('requires real server choices for a normal emotion card',()=>{
 const emotionCard={triggerFactor:'상황',primaryEmotions:['서운함'],secondaryEmotions:['허무함']};
 expect(decodeTurn({...turn,nextInput:'EMOTION_CARD',emotionCard}).emotionCard).toEqual(emotionCard);
});
it('maps records without inventing scores, slots or recommendations',()=>{
 const result=decodeServerRecord({...record,preIntensity:null,recommendedMalangi:null});
 expect(result.context.pre).toBeNull(); expect(result.context.post).toBe(0); expect(result.context.slots).toEqual({}); expect(result.recommended).toBeNull();
 expect(()=>decodeServerRecord({...record,preIntensity:11})).toThrow();
 expect(()=>decodeServerRecord({...record,createdAt:'broken'})).toThrow();
});
it('shows user and assistant transcript, excluding server/system instructions',()=>{
 expect(decodeMessages({messages:[{messageId:1,type:'USER',content:'이야기',time:'12:00'},{messageId:2,type:'SYSTEM',content:'secret'},{messageId:3,type:'EMOTION_CARD',content:null},{messageId:4,type:'ASSISTANT',content:'답변',time:'12:01'}]}).map(v=>v.text)).toEqual(['이야기','답변']);
});
it('only accepts completion with a saved numeric result ID',()=>{
 expect(decodeCompletionId({status:'COMPLETED',resultId:8})).toBe('8');
 expect(()=>decodeCompletionId({status:'IN_PROGRESS',resultId:8})).toThrow();
});
it('loads all pages, deduplicates IDs and handles empty 204 deletion',async()=>{
 authSession.set({accessToken:'test',refreshToken:'test'});
 const ok=(data:unknown)=>Response.json({success:true,data,error:null});
 const fetcher=vi.fn().mockResolvedValueOnce(ok({content:[record],pageNumber:0,last:false})).mockResolvedValueOnce(ok({content:[record,{...record,resultId:5}],pageNumber:1,last:true})).mockResolvedValueOnce(new Response(null,{status:204}));
 vi.stubGlobal('fetch',fetcher);
 expect((await serverRecords.records()).map(r=>r.id)).toEqual(['4','5']);
 await expect(serverRecords.deleteRecord('4')).resolves.toEqual({ok:true});
 expect(fetcher).toHaveBeenCalledTimes(3);
});
it('rejects broken pagination instead of silently dropping history',async()=>{
 authSession.set({accessToken:'test',refreshToken:'test'});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({success:true,data:{content:[],pageNumber:0,last:false},error:null})));
 await expect(serverRecords.records()).rejects.toThrow();
});

it('groups UTC timestamps under their Korean calendar day', () => {
  expect(localDate('2026-11-19T14:59:59Z')).toBe('2026-11-19');
  expect(localDate('2026-11-19T15:00:00Z')).toBe('2026-11-20');
});

it('interprets backend offset-less LocalDateTime as UTC, without shifting explicit offsets twice', () => {
  for (const source of ['2026-11-19T15:00:00','2026-11-19T15:00:00.123456','2026-11-19T15:00:00Z','2026-11-20T00:00:00+09:00']) {
    const decoded = decodeServerRecord({ ...record, createdAt:source });
    expect(localDate(decoded.createdAt)).toBe('2026-11-20');
    expect(new Date(decoded.createdAt).getUTCHours()).toBe(15);
  }
  expect(localDate(decodeServerRecord({ ...record, createdAt:'2026-11-19T14:59:59' }).createdAt)).toBe('2026-11-19');
  expect(() => decodeServerRecord({ ...record, createdAt:'2026-11-20' })).toThrow();
});
