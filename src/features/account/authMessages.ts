import { ApiError } from '../../lib/api';

const PROVIDERS: Record<string, string> = { LOCAL: '이메일', KAKAO: '카카오', DISCORD: '디스코드', GOOGLE: '구글' };

/** 409 EMAIL_ALREADY_REGISTERED: the backend refuses to merge accounts and names the existing provider. */
export function alreadyRegistered(error: ApiError) {
  const provider = error.details && typeof error.details === 'object' && 'existingProvider' in error.details ? String(error.details.existingProvider) : '';
  return `이미 가입된 이메일이에요. ${PROVIDERS[provider] ?? '기존'} 계정으로 로그인해 주세요.`;
}

export function describeEmailAuthError(error: unknown, signup: boolean) {
  if (!(error instanceof ApiError)) return '잠시 후 다시 시도해 주세요.';
  if (error.code === 'INVALID_CREDENTIALS') return '이메일 또는 비밀번호가 맞지 않아요.';
  if (error.code === 'EMAIL_ALREADY_REGISTERED') return alreadyRegistered(error);
  if (error.code === 'INVALID_INPUT' || error.status === 400) return signup ? '입력한 내용을 다시 확인해 주세요. 비밀번호는 8자 이상이어야 해요.' : '입력한 내용을 다시 확인해 주세요.';
  return error.message;
}

export function describeOAuthError(error: unknown) {
  if (!(error instanceof ApiError)) return '카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.';
  if (error.code === 'EMAIL_ALREADY_REGISTERED') return alreadyRegistered(error);
  if (error.code === 'INVALID_SOCIAL_CREDENTIALS') return '카카오 계정을 확인하지 못했어요. 이메일 제공에 동의했는지 확인한 뒤 다시 시도해 주세요.';
  if (error.code === 'SOCIAL_PROVIDER_UNAVAILABLE' || error.status === 502) return '카카오 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.';
  return error.message;
}
