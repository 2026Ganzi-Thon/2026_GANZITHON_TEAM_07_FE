import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import styles from './App.module.css';
import { PreviewProvider } from './lib/PreviewContext';

export function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--visual-height', `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  return <PreviewProvider><div className={styles.canvas}><div className={styles.app}><Routes>
    <Route path="/" element={<main className="bootError"><h1>테슬랑</h1><p>공통 실행 기반</p></main>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></div></div></PreviewProvider>;
}
