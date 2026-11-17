import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import styles from './App.module.css';
import { PreviewProvider } from './lib/PreviewContext';
import { RequirePreview } from './lib/PreviewContext';
import { Home } from './features/home/Home';
import { Toy } from './features/toy/Toy';
import { ToyPreferencesProvider } from './features/toy/ToyPreferences';
import { Login, Settings, Help } from './features/account/Account';

export function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--visual-height', `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  return <PreviewProvider><ToyPreferencesProvider><div className={styles.canvas}><div className={styles.app}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} /><Route path="/settings" element={<Settings />} /><Route path="/help" element={<Help />} />
    <Route path="/malangi" element={<RequirePreview><Toy /></RequirePreview>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></div></div></ToyPreferencesProvider></PreviewProvider>;
}
