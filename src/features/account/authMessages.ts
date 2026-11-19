import { ApiError } from '../../lib/api';

/** 409 EMAIL_ALREADY_REGISTERED: the backend refuses to merge accounts. */
export function alreadyRegistered(error: ApiError) {
  const provider = error.details && typeof error.details === 'object' && 'existingProvider' in error.details ? String(error.details.existingProvider) : '';
  return provider === 'LOCAL' ? '이미 가입된 이메일이에요. 이메일 계정으로 로그인해 주세요.' : '이미 가입된 이메일이에요. 가입된 계정의 로그인 방법을 확인해 주세요.';
}

export function describeEmailAuthError(error: unknown, signup: boolean) {
  if (!(error instanceof ApiError)) return '잠시 후 다시 시도해 주세요.';
  if (error.code === 'INVALID_CREDENTIALS') return '이메일 또는 비밀번호가 맞지 않아요.';
  if (error.code === 'EMAIL_ALREADY_REGISTERED') return alreadyRegistered(error);
  if (error.code === 'INVALID_INPUT' || error.status === 400) return signup ? '입력한 내용을 다시 확인해 주세요. 비밀번호는 8자 이상이어야 해요.' : '입력한 내용을 다시 확인해 주세요.';
  return error.message;
}
