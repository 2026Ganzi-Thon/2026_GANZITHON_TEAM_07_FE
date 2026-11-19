import { readSettingsReturn } from '../../components/SettingsLink';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, HeartHandshake, LogOut } from 'lucide-react';
import { Modal } from '../../components/ui';
import { Page } from '../../components/Page';
import { accountApi } from '../../lib/api';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import s from '../../components/Page.module.css';
import styles from './Account.module.css';
import { DESIGN_ASSETS } from '../../lib/assets';
export { Login } from './Login';
export function Settings() {
  const location = useLocation();
  const settingsReturn = readSettingsReturn(location.state?.settingsReturn);
  const user = useProfile(); const preview = usePreview(); const client = useQueryClient(); const navigate = useNavigate();
  const [sheet, setSheet] = useState<'about' | null>(null);
  const logout = useMutation({ mutationFn: accountApi.logout, onSuccess: () => { preview.drafts.clear(); client.removeQueries({ queryKey: ['preview'] }); client.setQueryData(['preview', 'me'], null); navigate('/', { replace: true }); } });
  return <Page title="MY" back={settingsReturn.to} backState={settingsReturn.state} className={styles.settingsPage}><div className={styles.profileCard}><div className={styles.profile}><span className={styles.userIcon}><img src={DESIGN_ASSETS.myProfile} width={71} height={71} alt="프로필 이미지" /></span><div><strong>{user.data?.nickname ?? '테슬랑에 오신 걸 환영해요'}</strong>{!user.data && <p>계정을 연결하고 마음을 남겨보세요</p>}</div></div>{!user.data && <Link className={s.secondary} to="/login?next=/settings">로그인하기</Link>}</div>
    <div className={styles.links}><Link to="/archive?manage=1" state={{ settingsReturn }}><span className={styles.menuDot} />기록 관리 / 삭제 / 가리기</Link><Link to="/help" state={{ from: 'settings', settingsReturn }}><span className={styles.menuDot} />도움 연결</Link><button disabled title="계정 연결 후 제공"><span className={styles.menuDot} />회원정보 수정</button><button disabled title="계정 연결 후 제공"><span className={styles.menuDot} />비밀번호 찾기/변경</button><button onClick={e => { e.currentTarget.focus(); setSheet('about'); }}><span className={styles.menuDot} />서비스 이용 안내<ChevronRight size={17} /></button></div>

    {logout.isError && <p role="alert" className={s.error}>{logout.error.message}</p>}{user.data && <button className={s.secondary} onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={17} />{logout.isPending ? '나가는 중…' : '로그아웃'}</button>}
    {sheet && <Modal title="서비스 이용 안내" onClose={() => setSheet(null)}><p>테스와 이야기를 나누고, 마음 보관함에서 기록을 돌아볼 수 있어요. 말랑이를 누르거나 늘리며 잠시 쉬어가세요.</p><p>테슬랑은 전문 상담이나 치료를 대신하지 않아요.</p><Link className={s.secondary} to="/help" state={{ from: 'settings', settingsReturn }}>도움 연결 보기</Link></Modal>}
  </Page>;
}
export function Help() {
  const location = useLocation();
  // Only a known internal origin is accepted; direct/safety entries return home.
  const back = location.state?.from === 'settings' ? '/settings' : '/';
  return <Page title="도움 연결" back={back} backState={back === '/settings' ? { settingsReturn: readSettingsReturn(location.state?.settingsReturn) } : undefined}><div className={styles.intro}><HeartHandshake size={40} strokeWidth={1.2} /><h2>혼자 감당하지 않아도<br />괜찮아요.</h2><p>지금 도움이 필요하다면<br />믿을 수 있는 사람이나 전문 지원에 연결해 보세요.</p></div><section className={s.card}><h2>자살예방상담전화 109</h2><p>전화 상담과 전문 지원 정보를 안내받을 수 있어요.</p><a className={s.primary} href="tel:109">109 전화 연결</a><a className={s.textLink} href="https://www.129.go.kr/109" target="_blank" rel="noreferrer">공식 안내 확인하기</a></section><p className={s.small}>대한민국 기준 도움 정보예요. 전화 버튼은 기기의 전화 앱으로 연결되며, 이 화면에서 실제 연결 여부를 확인할 수는 없어요.</p><Link className={s.secondary} to="/">메인으로 돌아가기</Link></Page>;
}
