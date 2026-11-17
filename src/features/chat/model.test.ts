import { describe, expect, it } from 'vitest';
import { chatReducer, initialChat, newContext } from './model';
import { previewReply } from '../../mocks/dialogue';

describe('chat input and finish boundaries', () => {
  it('accepts a primary emotion alone and does not preselect an intensity', () => {
    const result = chatReducer({ ...initialChat(), stage: 'EMOTIONS' }, { type: 'emotions', primary: '불안', secondary: null });
    expect(result.stage).toBe('PRE'); expect(result.secondary).toBeNull(); expect(result.pre).toBeNull();
  });
  it('rejects unknown and duplicate structured emotions', () => {
    const initial = { ...initialChat(), stage: 'EMOTIONS' as const };
    expect(chatReducer(initial, { type: 'emotions', primary: '기타 직접 입력', secondary: null })).toBe(initial);
    expect(chatReducer(initial, { type: 'emotions', primary: '불안', secondary: '불안' })).toBe(initial);
  });
  it('accepts an explicit zero but does not silently accept a missing pre score', () => {
    const initial = { ...initialChat(), stage: 'PRE' as const };
    expect(chatReducer(initial, { type: 'intensity', value: null })).toBe(initial);
    const result = chatReducer(initial, { type: 'intensity', value: 0 });
    expect(result.pre).toBe(0); expect(result.stage).toBe('THOUGHT');
  });
  it('does not turn a skipped post score into zero', () => {
    const result = chatReducer({ ...initialChat(), stage: 'POST', pre: 8 }, { type: 'intensity', value: null });
    expect(result.stage).toBe('DONE'); expect(result.post).toBeNull(); expect(result.pre).toBe(8);
  });
  it('rejects out-of-range and fractional scores', () => {
    const initial = { ...initialChat(), stage: 'PRE' as const };
    for (const value of [-1, 11, 0.5]) expect(chatReducer(initial, { type: 'intensity', value })).toBe(initial);
  });
  it('does not request a post score when ending before emotion selection', () => {
    const initial = initialChat();
    expect(chatReducer(initial, { type: 'finish' })).toBe(initial);
  });
  it('finishes through the post-score card after emotion selection', () => {
    const result = chatReducer({ ...initialChat(), stage: 'THOUGHT', primary: '불안', pre: 6 }, { type: 'finish' });
    expect(result.stage).toBe('POST'); expect(result.post).toBeNull();
  });
});

describe('explicitly scripted preview responses', () => {
  const request = (text: string, context = newContext()) => previewReply({ text, context, requestId: 'test' });
  it('keeps a vague opening in OPEN but advances a fixture event', () => {
    expect(request('그냥 힘들어요').stage).toBe('OPEN');
    expect(request('회의에서 의견을 말했는데 아무도 반응하지 않았어요').stage).toBe('EMOTIONS');
  });
  it('preserves unknown count across another response in the same stage', () => {
    const context = newContext();
    const first = request('모르겠어요', context);
    const second = request('그냥 힘들어요', { ...context, unknowns: first.unknowns });
    expect(second.unknowns.OPEN).toBe(1);
    expect(request('그래도 모르겠어요', { ...context, unknowns: second.unknowns }).stage).toBe('EMOTIONS');
  });
  it('allows an explicit inability to reframe once without inventing a new thought', () => {
    const response = request('지금 다르게 생각하기 어려워요', { ...newContext(), stage: 'REFRAME' });
    expect(response.stage).toBe('NEED'); expect(response.slots.REFRAME).toBeUndefined();
  });
  it('does not continue the preview script after an explicit risk fixture', () => {
    expect(request('자해하고 싶어요').stage).toBe('SAFETY');
  });
});


describe('documented skip boundaries in the preview', () => {
  it('does not treat a word inside a substantive reply as an empty answer', () => {
    const response = previewReply({ text: '하루밖에 없어서 걱정이 됐어요', context: { ...newContext(), stage: 'THOUGHT' }, requestId: 'content' });
    expect(response.stage).toBe('REFRAME'); expect(response.slots.THOUGHT).toBe('하루밖에 없어서 걱정이 됐어요');
  });
  it('accepts no need or resource immediately', () => {
    for (const stage of ['NEED', 'COPING'] as const) {
      const response = previewReply({ text: '없어요', context: { ...newContext(), stage }, requestId: stage });
      expect(response.stage).not.toBe(stage); expect(response.slots[stage]).toBe('없어요');
    }
  });
  it('asks for context when only being scolded is mentioned', () => {
    expect(previewReply({ text: '혼났어', context: newContext(), requestId: 'vague' }).stage).toBe('OPEN');
  });
});
