import { describe, it, expect } from 'vitest';
import { PreviewStore } from './store';
import { newContext } from '../features/chat/model';
const context = (primary = '속상함') => ({ ...newContext(), stage: 'DONE' as const, primary, pre: 0, post: null, slots: { OPEN: '회의에서 준비한 의견에 반응이 없었어요.' } });
describe('preview record ownership and lifecycle', () => {
  it('requires an explicit preview account', () => { const db = new PreviewStore(); expect(() => db.list()).toThrow('UNAUTHORIZED'); });
  it('is idempotent and preserves zero, null and missing slots', () => {
    const db = new PreviewStore(); db.login('demo-a');
    const first = db.save('same', context()); const second = db.save('same', context('분노'));
    expect(second).toBe(first); expect(db.list()).toHaveLength(1); expect(first.context.pre).toBe(0); expect(first.context.post).toBeNull(); expect(first.context.slots.REFRAME).toBeUndefined();
  });
  it('isolates records and inventory between preview accounts', () => {
    const db = new PreviewStore(); db.login('demo-a'); db.save('private', context('분노'));
    expect(db.inventory().unlocked).toContain('WAKPPU'); db.logout(); db.login('demo-b');
    expect(db.list()).toEqual([]); expect(db.get('private')).toBeUndefined(); expect(db.delete('private')).toBe(false); expect(db.inventory().unlocked).toEqual(['SLANGI', 'SQUISHY', 'WAKPPU']);
    db.logout(); db.login('demo-a'); expect(db.get('private')).toBeDefined();
  });
  it('allows all toys before counseling and keeps original recommendations when changing selection', () => {
    const db = new PreviewStore(); db.login('demo-a'); expect(db.select('WAKPPU').selected).toBe('WAKPPU'); expect(db.select('SQUISHY').selected).toBe('SQUISHY');
    const record = db.save('one', context()); db.select('SQUISHY'); db.select('SLANGI'); expect(record.recommended).toBe('SQUISHY');
  });
  it('deletes only the requested record, without relocking a toy', () => {
    const db = new PreviewStore(); db.login('demo-a'); db.save('one', context()); db.save('two', context('분노'));
    expect(db.delete('one')).toBe(true); expect(db.get('one')).toBeUndefined(); expect(db.list().map(r => r.id)).toEqual(['two']); expect(db.inventory().unlocked).toContain('SQUISHY');
  });
  it('does not record unfinished or emotionless sessions', () => {
    const db = new PreviewStore(); db.login('demo-a'); expect(() => db.save('empty', { ...newContext(), stage: 'DONE' })).toThrow('INVALID_RESULT'); expect(() => db.save('open', newContext())).toThrow('INVALID_RESULT');
  });
  it('explicit partial save snapshots only supplied data and is idempotent', () => {
    const db = new PreviewStore(); db.login('demo-a');
    const ctx = newContext();
    const messages = [{ id: 'm1', role: 'user' as const, text: '그냥 조금 힘들어요', time: '12:00' }];
    const saved = db.save('partial', ctx, messages, true);
    ctx.slots.OPEN = 'later change'; messages[0].text = 'later change';
    expect(saved).toMatchObject({ partial: true, hidden: false, recommended: null, summary: '그냥 조금 힘들어요', context: { primary: null, pre: null, post: null, slots: {} } });
    expect(saved.messages?.[0].text).toBe('그냥 조금 힘들어요');
    expect(db.save('partial', ctx, messages, true)).toBe(saved);
    expect(db.list()).toHaveLength(1);
    expect(() => db.save('empty', newContext(), [], true)).toThrow('INVALID_RESULT');
    expect(() => db.save('safety', { ...newContext(), stage: 'SAFETY' }, messages, true)).toThrow('INVALID_RESULT');
  });
  it('hides without deleting, restores content and enforces ownership', () => {
    const db = new PreviewStore(); db.login('demo-a'); const original = db.save('one', context());
    expect(db.setHidden('one', true)).toMatchObject({ hidden: true, summary: original.summary });
    expect(db.list()).toHaveLength(1);
    db.login('demo-b'); expect(db.setHidden('one', false)).toBeUndefined();
    db.login('demo-a'); expect(db.get('one')?.hidden).toBe(true);
    expect(db.setHidden('one', false)?.context.pre).toBe(0);
    expect(db.get('one')?.hidden).toBe(false);
  });
  it('updates a partial snapshot after a lost response without duplicating or rolling back newer content', () => {
    const db = new PreviewStore(); db.login('demo-a');
    const firstMessages = [{ id: '1', role: 'user' as const, text: '힘들어요', time: '12:00' }];
    const first = db.save('same', newContext(), firstMessages, true);
    const later = [...firstMessages, { id: '2', role: 'user' as const, text: '회의에서 의견을 무시당했어요', time: '12:01' }];
    const updated = db.save('same', context(), later, true);
    expect(updated.createdAt).toBe(first.createdAt); expect(updated.messages).toHaveLength(2);
    expect(db.save('same', newContext(), firstMessages, true)).toBe(updated);
    const completed = db.save('same', context(), later);
    expect(completed.partial).toBe(false); expect(completed.recommended).toBe('SQUISHY');
    expect(db.save('same', newContext(), firstMessages, true)).toBe(completed);
    expect(db.list()).toHaveLength(1);
  });
});
