import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { accountApi, ApiError } from '../../lib/api';
import type { Profile } from '../../lib/domain';
import { usePreview } from '../../lib/PreviewContext';
import s from '../../components/Page.module.css';
import styles from './Account.module.css';

type Mode = 'login' | 'signup';
const PROVIDERS: Record<string, string> = { LOCAL: '이메일', KAKAO: '카카오', DISCORD: '디스코드', GOOGLE: '구글' };
// Backend limits: email ≤255, password 8~72 chars and ≤72 UTF-8 bytes, nickname ≤50.
const passwordBytes = (value: string) => new TextEncoder().encode(value).length;

function describe(error: unknown, mode: Mode) {
  if (!(error instanceof ApiError)) return '잠시 후 다시 시도해 주세요.';
  if (error.code === 'INVALID_CREDENTIALS') return '이메일 또는 비밀번호가 맞지 않아요.';
  if (error.code === 'EMAIL_ALREADY_REGISTERED') {
    const provider = error.details && typeof error.details === 'object' && 'existingProvider' in error.details ? String(error.details.existingProvider) : '';
    return `이미 가입된 이메일이에요. ${PROVIDERS[provider] ?? '기존'} 계정으로 로그인해 주세요.`;
  }
  if (error.code === 'INVALID_INPUT' || error.status === 400) return mode === 'signup' ? '입력한 내용을 다시 확인해 주세요. 비밀번호는 8자 이상이어야 해요.' : '입력한 내용을 다시 확인해 주세요.';
  return error.message;
}

/** real mode SC09: one email login (D26). Passwords stay in this component's state only and are never stored. */
export function EmailAuth({ destination }: { destination: string }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [nickname, setNickname] = useState('');
  const [reveal, setReveal] = useState(false); const [notice, setNotice] = useState('');
  const navigate = useNavigate(); const client = useQueryClient(); const preview = usePreview(); const id = useId();
  const signedIn = (profile: Profile) => {
    client.removeQueries({ queryKey: ['preview'] }); preview.drafts.clear();
    client.setQueryData(['preview', 'me'], profile); navigate(destination, { replace: true });
  };
  const submit = useMutation({
    mutationFn: async () => {
      const address = email.trim();
      if (mode === 'signup') {
        await accountApi.signupWithEmail(address, password, nickname.trim());
        try { return await accountApi.loginWithEmail(address, password); }
        catch { throw new Error('SIGNED_UP_LOGIN_FAILED'); }
      }
      return accountApi.loginWithEmail(address, password);
    },
    onSuccess: signedIn,
    onError: error => {
      if (error instanceof Error && error.message === 'SIGNED_UP_LOGIN_FAILED') {
        setMode('login'); setPassword(''); setNotice('가입은 완료됐어요. 로그인해 주세요.'); submit.reset();
      }
    },
  });
  const passwordLength = password.length;
  const invalid = !email.trim() || !password || (mode === 'signup' && (passwordLength < 8 || passwordLength > 72 || passwordBytes(password) > 72 || !nickname.trim()));
  const switchMode = (next: Mode) => { if (submit.isPending) return; setMode(next); setNotice(''); submit.reset(); setPassword(''); };
  const onSubmit = (event: FormEvent) => { event.preventDefault(); if (!invalid && !submit.isPending) { setNotice(''); submit.mutate(); } };

  return <form className={styles.emailForm} onSubmit={onSubmit} noValidate aria-busy={submit.isPending}>
    <div className={styles.authTabs} role="group" aria-label="계정 연결 방식">
      <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>로그인</button>
      <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>회원가입</button>
    </div>
    <label className={styles.field} htmlFor={`${id}-email`}>이메일
      <input id={`${id}-email`} type="email" inputMode="email" autoComplete={mode === 'login' ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} maxLength={255}
        value={email} onChange={event => setEmail(event.target.value)} disabled={submit.isPending} required />
    </label>
    {mode === 'signup' && <label className={styles.field} htmlFor={`${id}-nickname`}>닉네임
      <input id={`${id}-nickname`} autoComplete="nickname" maxLength={50} value={nickname} onChange={event => setNickname(event.target.value)} disabled={submit.isPending} required />
    </label>}
    <label className={styles.field} htmlFor={`${id}-password`}>비밀번호
      <span className={styles.passwordRow}>
        <input id={`${id}-password`} type={reveal ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={72}
          aria-describedby={mode === 'signup' ? `${id}-password-hint` : undefined} value={password} onChange={event => setPassword(event.target.value)} disabled={submit.isPending} required />
        <button type="button" className={styles.reveal} aria-label={reveal ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={reveal} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </span>
    </label>
    {mode === 'signup' && <p id={`${id}-password-hint`} className={styles.fieldHint}>8자 이상 72자 이하로 입력해 주세요.</p>}
    {notice && <p className={s.small} role="status">{notice}</p>}
    {submit.isError && <p className={s.error} role="alert">{describe(submit.error, mode)}</p>}
    <button type="submit" className={s.primary} disabled={invalid || submit.isPending}>
      {submit.isPending ? (mode === 'signup' ? '가입하고 있어요…' : '로그인하고 있어요…') : mode === 'signup' ? '가입하고 시작하기' : '로그인'}
    </button>
  </form>;
}
