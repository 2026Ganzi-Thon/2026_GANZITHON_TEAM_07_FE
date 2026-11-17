import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Flower2, HeartHandshake, LogOut, UserRound } from 'lucide-react';
import { Avatar, Modal } from '../../components/ui';
import { DemoNotice, Page } from '../../components/Page';
import { previewApi } from '../../lib/api';
import { usePreview, useProfile } from '../../lib/PreviewContext';
import s from '../../components/Page.module.css';
import styles from './Account.module.css';
const profiles = [{ id: 'demo-a', nickname: '마음 산책자' }, { id: 'demo-b', nickname: '느긋한 오후' }];
export function Login() {
  const [chosen, setChosen] = useState('demo-a'); const [params] = useSearchParams(); const navigate = useNavigate(); const client = useQueryClient();
  const preview = usePreview();
  const next = params.get('next') ?? '/';
  const destination = /^\/(chat|archive|malangi|settings|results\/[^/?]+|records\/[^/?]+)(\?.*)?$/.test(next) ? next : '/';
  const login = useMutation({ mutationFn: () => previewApi.login(chosen), onSuccess: user => {
    client.removeQueries({ queryKey: ['preview'] }); preview.drafts.clear(); client.setQueryData(['preview', 'me'], user); navigate(destination, { replace: true });
  } });
  return <Page title="로그인 연결"><div className={styles.intro}><Avatar large /><span className={s.eyebrow}></span><h2>테슬랑</h2><p>사용할 체험 계정을 선택해 주세요.</p></div><DemoNotice />
    <div className={styles.accounts} role="group" aria-label="체험 계정">{profiles.map(profile => <button key={profile.id} aria-pressed={chosen === profile.id} disabled={login.isPending} onClick={() => setChosen(profile.id)}><UserRound size={21} /><span>{profile.nickname}<small>예시 계정 · {profile.id === 'demo-a' ? 'A' : 'B'}</small></span>{chosen === profile.id && <Check size={18} />}</button>)}</div>
    {login.isError && <p className={s.error} role="alert">{login.error.message}</p>}
    <button className={s.primary} disabled={login.isPending} onClick={() => login.mutate()}>{login.isPending ? '연결하고 있어요…' : '체험 계정으로 계속하기'}</button>
    <p className={s.small}>실제 로그인·회원가입이 아닌 화면 체험이에요. 로그인 방식은 팀 협의 후 연결하며, 지금은 개인정보나 비밀번호를 입력하지 않아요.</p>
    <p className={s.small}>테슬랑은 전문 상담이나 치료를 대신하지 않아요.</p>
  </Page>;
}
export function Settings() {
  const user = useProfile(); const preview = usePreview(); const client = useQueryClient(); const navigate = useNavigate();
  const [sheet, setSheet] = useState<'data' | 'about' | 'account' | null>(null); const [faults, setFaults] = useState({ ...preview.faults });
  const logout = useMutation({ mutationFn: previewApi.logout, onSuccess: () => { preview.drafts.clear(); client.removeQueries({ queryKey: ['preview'] }); client.setQueryData(['preview', 'me'], null); navigate('/', { replace: true }); } });
  return <Page title="MY" className={styles.settingsPage}><div className={styles.profileCard}><div className={styles.profile}><span className={styles.userIcon}><UserRound size={32} /></span><div><strong>{user.data?.nickname ?? '테슬랑에 오신 걸 환영해요'}</strong><p>{user.data ? '체험 계정으로 둘러보는 중' : '계정을 연결하고 마음을 남겨보세요'}</p></div></div>{!user.data && <Link className={s.secondary} to="/login?next=/settings">체험 계정 연결하기</Link>}</div>
    <div className={styles.links}><Link to="/archive"><Flower2 size={19} />기록 관리<ChevronRight size={17} /></Link><Link to="/help"><HeartHandshake size={19} />도움 연결<ChevronRight size={17} /></Link><button onClick={e => { e.currentTarget.focus(); setSheet('account'); }}>회원정보 수정<ChevronRight size={17} /></button><button onClick={e => { e.currentTarget.focus(); setSheet('account'); }}>비밀번호 찾기/변경<ChevronRight size={17} /></button><button onClick={e => { e.currentTarget.focus(); setSheet('about'); }}>서비스 이용 안내<ChevronRight size={17} /></button><button onClick={e => { e.currentTarget.focus(); setSheet('data'); }}>체험 데이터 안내<ChevronRight size={17} /></button></div>
    <details className={styles.qa}><summary>미리보기 오류 상태 확인</summary><p className={s.small}>다음 요청을 한 번 실패시켜 복구 흐름을 확인해요.</p>{(['save', 'list', 'remove'] as const).map(key => <label key={key}><input type="checkbox" checked={faults[key]} onChange={e => { preview.faults[key] = e.target.checked; setFaults({ ...preview.faults }); }} />{({ save: '결과 저장', list: '보관함 조회', remove: '기록 삭제' })[key]} 오류 1회</label>)}</details>
    {logout.isError && <p role="alert" className={s.error}>{logout.error.message}</p>}{user.data && <button className={s.secondary} onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={17} />{logout.isPending ? '나가는 중…' : '체험 계정 나가기'}</button>}<p className={s.small}>실제 계정 관리·약관·동의 절차는 연동 전 협의 항목이에요.</p>
    {sheet && <Modal title={sheet === 'data' ? '체험 데이터 안내' : sheet === 'account' ? '계정 관리' : '서비스 이용 안내'} onClose={() => setSheet(null)}><p>{sheet === 'account' ? '회원정보 수정과 비밀번호 변경은 실제 로그인 연결 후 이용할 수 있어요. 현재 체험 계정에서는 개인정보나 비밀번호를 받지 않아요.' : sheet === 'data' ? '입력과 기록은 현재 페이지의 메모리에만 유지돼요. 새로고침하면 모두 초기화되며 실제 서버나 브라우저 저장소에는 저장하지 않아요. 체험 계정별 기록은 분리해 보여줘요. 실제 서비스의 데이터 보관·삭제 정책을 뜻하지 않아요.' : '현재 대화는 화면 흐름을 확인하기 위한 예시 응답이에요. 실제 AI 분석·상담 결과가 아니며 전문 상담이나 치료를 대신하지 않아요. 말랑이는 정식 자산을 연결하기 전의 기본 조작 시안이에요.'}</p><Link className={s.secondary} to="/help">도움 연결 보기</Link></Modal>}
  </Page>;
}
export function Help() {
  return <Page title="도움 연결"><div className={styles.intro}><HeartHandshake size={40} strokeWidth={1.2} /><h2>혼자 감당하지 않아도<br />괜찮아요.</h2><p>지금 도움이 필요하다면<br />믿을 수 있는 사람이나 전문 지원에 연결해 보세요.</p></div><section className={s.card}><h2>자살예방상담전화 109</h2><p>전화 상담과 전문 지원 정보를 안내받을 수 있어요.</p><a className={s.primary} href="tel:+82109?oai_link_source=model_response_hotline">109 전화 연결</a><a className={s.textLink} href="https://www.129.go.kr/109?oai_link_source=model_response_hotline" target="_blank" rel="noreferrer">공식 안내 확인하기</a></section><p className={s.small}>대한민국 기준 도움 정보예요. 전화 버튼은 기기의 전화 앱으로 연결되며, 이 화면에서 실제 연결 여부를 확인할 수는 없어요.</p><p className={s.small}>이 미리보기의 제한된 위험 표현 감지는 실제 위기 대응 기능이 아니에요. 일반 대화는 중단되며 이 경로에서는 상담 결과나 말랑이 추천을 생성하지 않아요.</p><Link className={s.secondary} to="/">메인으로 돌아가기</Link></Page>;
}
