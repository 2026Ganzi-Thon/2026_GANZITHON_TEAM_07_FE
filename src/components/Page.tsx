import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import styles from './Page.module.css';
export function Page({ title, back = '/', backState, children, action, className = '', titlePlacement = 'header' }: { title: string; back?: string; backState?: unknown; children: ReactNode; action?: ReactNode; className?: string; titlePlacement?: 'header' | 'body' | 'hidden' }) {
  return <main className={`${styles.page} ${className}`}><header className={styles.header}><Link to={back} state={backState} aria-label="뒤로가기"><ArrowLeft size={21} /></Link>{titlePlacement !== 'body' && <h1 className={titlePlacement === 'hidden' ? styles.visuallyHidden : undefined}>{title}</h1>}<div>{action}</div></header><div className={styles.body}>{titlePlacement === 'body' && <h1 className={styles.bodyTitle}>{title}</h1>}{children}</div></main>;
}
export function Pending({ children = '잠시만 기다려 주세요.' }: { children?: ReactNode }) { return <div className={styles.empty} role="status"><span className={styles.spinner} />{children}</div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className={styles.empty} role="alert"><h2>{message}</h2>{retry && <button className={styles.secondary} onClick={retry}><RefreshCw size={16} /> 다시 시도하기</button>}<Link className={styles.textLink} to="/">메인으로 돌아가기</Link></div>; }
export function PrimaryLink({ to, state, children }: { to: string; state?: unknown; children: ReactNode }) { return <Link className={styles.primary} to={to} state={state}>{children}<ArrowRight size={17} /></Link>; }
export function DemoNotice() { return <p className={styles.notice}>예시 데이터 · 새로고침하면 체험 계정과 기록이 초기화돼요.</p>; }
