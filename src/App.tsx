import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Home } from './features/home/Home';
import { Chat } from './features/chat/Chat';
import styles from './App.module.css';
import { PreviewProvider, RequirePreview } from './lib/PreviewContext';
import { Login, Settings, Help } from './features/account/Account';
import { OAuthCallback } from './features/account/OAuthCallback';
import { Archive, RecordDetail, Result } from './features/records/Records';
import { Toy } from './features/toy/Toy';
import { ToyPreferencesProvider } from './features/toy/ToyPreferences';

export function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--visual-height', `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  return <PreviewProvider><ToyPreferencesProvider><div className={styles.canvas}>
    <div className={styles.app}><Routes><Route path="/" element={<Home />} /><Route path="/chat" element={<RequirePreview><Chat /></RequirePreview>} />
      <Route path="/login" element={<Login />} /><Route path="/oauth/callback/:provider" element={<OAuthCallback />} /><Route path="/settings" element={<Settings />} /><Route path="/help" element={<Help />} />
      <Route path="/malangi" element={<RequirePreview><Toy /></RequirePreview>} />
      <Route path="/results/:id" element={<RequirePreview><Result /></RequirePreview>} />
      <Route path="/archive" element={<RequirePreview><Archive /></RequirePreview>} />
      <Route path="/records/:id" element={<RequirePreview><RecordDetail /></RequirePreview>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div>

  </div></ToyPreferencesProvider></PreviewProvider>;
}
