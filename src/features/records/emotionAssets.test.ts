import { describe, expect, it } from 'vitest';
import { emotionImage } from './emotionAssets';

describe('emotion artwork mapping', () => {
  it('uses distinct artwork for the twelve supplied emotions', () => {
    const labels = ['모르겠음', '불안함', '서운함', '속상함', '슬픔', '신남', '우울함', '평온', '행복함', '화남', '감사함', '기쁨'];
    const images = labels.map(emotionImage);
    expect(images.every(Boolean)).toBe(true);
    expect(new Set(images).size).toBe(12);
  });
  it('maps existing stored names without changing the stored emotion', () => {
    expect(emotionImage('불안')).toBe(emotionImage('불안함'));
    expect(emotionImage('분노')).toBe(emotionImage('화남'));
    expect(emotionImage('우울')).toBe(emotionImage('우울함'));
    expect(emotionImage(' 불안함 ')).toBe(emotionImage('불안함'));
  });
  it('does not equate missing, unmapped or stressed feelings with explicitly unknown', () => {
    for (const emotion of [null, '', '스트레스', '새 감정', 'constructor', '__proto__']) expect(emotionImage(emotion)).toBeNull();
    expect(emotionImage('모르겠음')).not.toBeNull();
  });
});
