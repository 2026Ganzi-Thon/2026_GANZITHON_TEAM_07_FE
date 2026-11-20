// Display aliases only. This does not expand the emotions accepted by chat/API.
const emotionAssets: Readonly<Record<string, string>> = {
  모르겠음: 'unknown',
  불안: 'anxious', 불안함: 'anxious',
  서운함: 'disappointed', 속상함: 'upset', 슬픔: 'sad',
  신남: 'excited', 우울: 'depressed', 우울함: 'depressed',
  평온: 'calm', 행복함: 'happy', 화남: 'angry', 분노: 'angry', 스트레스: 'angry',
  감사함: 'grateful', 기쁨: 'joyful',
  억울함: 'sad', 답답함: 'unknown', 외로움: 'depressed', 허무함: 'disappointed',
};

export function emotionImage(emotion: string | null): string | null {
  const key = emotion?.trim();
  const asset = key && Object.hasOwn(emotionAssets, key) ? emotionAssets[key] : null;
  return asset ? `/assets/design/emotions/${asset}.png` : null;
}
