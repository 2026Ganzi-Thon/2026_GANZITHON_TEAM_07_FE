import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, UserRound } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { previewApi } from '../../lib/api';
import { API_MODE } from '../../lib/apiMode';
import { DESIGN_ASSETS } from '../../lib/assets';
import { discardPendingOAuth, startKakaoLogin } from '../../lib/oauth';
import { usePreview } from '../../lib/PreviewContext';
import { EmailAuth } from './EmailAuth';
import s from '../../components/Page.module.css';
import styles from './Login.module.css';

/** Only known in-app pages are accepted as the post-login destination. */
export function loginDestination(next: string | null) {
  const value = next ?? '/';
  return /^\/(chat|archive|malangi|settings|results\/[^/?]+|records\/[^/?]+)(\?.*)?$/.test(value) ? value : '/';
}

const profiles = [{ id: 'demo-a', nickname: '마음 산책자' }, { id: 'demo-b', nickname: '느긋한 오후' }];

/**
 * SC09, Figma 151:11030. Decisions (2026-11-18): Kakao + email only; Apple/phone/password-reset are hidden
 * because the backend has no such API. The official Kakao button is always shown in both modes; it needs
 * VITE_KAKAO_CLIENT_ID to start and the backend (real mode) to finish. mock mode keeps the demo accounts
 * on the same layout (button names unchanged for existing tests).
 */
export function Login() {
  const [params] = useSearchParams();
  const destination = loginDestination(params.get('next'));
  const [sheet, setSheet] = useState(false);
  const [kakaoError, setKakaoError] = useState('');
  const preview = usePreview();
  // Returning here without a callback (e.g. back from the Kakao page) abandons that request; keep its message.
  // A back navigation can restore this page from the bfcache without remounting, so also listen to pageshow.
  useEffect(() => {
    const abandon = () => { const entry = discardPendingOAuth(); if (entry && !preview.entry) preview.entry = { text: entry }; };
    abandon();
    const restored = (event: PageTransitionEvent) => { if (event.persisted) abandon(); };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, [preview]);
  return <main className={styles.page} aria-labelledby="login-title">
    <Link to="/" className={styles.back} aria-label="메인으로 돌아가기"><ArrowLeft size={22} /></Link>
    <div className={styles.backdrop} aria-hidden="true"><img className={styles.statue} src={DESIGN_ASSETS.socrates} width={471} height={707} alt="" /></div>
    <div className={styles.hero}>
      <h1 id="login-title"><img src={DESIGN_ASSETS.wordmark} width={170} height={55.7282} alt="테슬랑" /></h1>
      <p>마음에도 말랑한 쉼표가 필요하니까,</p>
    </div>
    <div className={styles.actions}>
      {/* Kakao Developers standard button (224x46, used as-is); the container widens with the same #FEE500. */}
      <button type="button" className={styles.kakao} onClick={() => { if (!startKakaoLogin(destination, preview.entry?.text)) setKakaoError('카카오 로그인 설정이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.'); }}>
        <img src={DESIGN_ASSETS.kakaoLogin} width={224} height={46} alt="카카오 로그인" />
      </button>
      {kakaoError && <p className={styles.note} role="alert">{kakaoError}</p>}
      {API_MODE === 'real' ? <>
        <button type="button" className={styles.secondary} aria-haspopup="dialog" aria-expanded={sheet} onClick={event => { event.currentTarget.focus(); setSheet(true); }}>
          <span className={styles.icon}><Mail size={20} strokeWidth={1.8} aria-hidden="true" /></span><span>이메일로 시작하기</span>
        </button>
      </> : <DemoAccounts destination={destination} />}
    </div>
    {sheet && <BottomSheet id="email-auth" title="이메일로 시작하기" closeLabel="닫기" onClose={() => setSheet(false)}>
      <EmailAuth destination={destination} />
      <p className={s.small}>로그인은 실제 계정으로 연결돼요. 상담·기록·말랑이는 아직 예시 데이터라 새로고침하면 초기화돼요.</p>
      <p className={s.small}>테슬랑은 전문 상담이나 치료를 대신하지 않아요.</p>
    </BottomSheet>}
  </main>;
}

function DemoAccounts({ destination }: { destination: string }) {
  const [chosen, setChosen] = useState('demo-a'); const navigate = useNavigate(); const client = useQueryClient(); const preview = usePreview();
  const login = useMutation({ mutationFn: () => previewApi.login(chosen), onSuccess: user => {
    client.removeQueries({ queryKey: ['preview'] }); preview.drafts.clear(); client.setQueryData(['preview', 'me'], user); navigate(destination, { replace: true });
  } });
  return <>
    <div className={styles.demo} role="group" aria-label="체험 계정">
      {profiles.map(profile => <button key={profile.id} type="button" aria-pressed={chosen === profile.id} disabled={login.isPending} onClick={() => setChosen(profile.id)}>
        <UserRound size={17} aria-hidden="true" />{profile.nickname}
      </button>)}
    </div>
    {login.isError && <p className={s.error} role="alert">{login.error.message}</p>}
    <button type="button" className={styles.secondary} disabled={login.isPending} onClick={() => login.mutate()}>
      <span className={styles.icon}><UserRound size={20} strokeWidth={1.8} aria-hidden="true" /></span><span>{login.isPending ? '연결하고 있어요…' : '체험 계정으로 계속하기'}</span>
    </button>
    <p className={styles.note}>실제 로그인이 아닌 화면 체험이에요. 개인정보나 비밀번호를 입력하지 않아요.</p>
  </>;
}
