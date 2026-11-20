import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Home } from './features/home/Home';
import { API_MODE } from './lib/apiMode';
import { LiveChat } from './features/chat/LiveChat';
import { Chat } from './features/chat/Chat';
import styles from './App.module.css';
import { PreviewProvider, RequirePreview } from './lib/PreviewContext';
import { Login, Settings, Help } from './features/account/Account';
import { Archive, RecordDetail, Result } from './features/records/Records';
import { Toy } from './features/toy/Toy';
import { ToyPreferencesProvider } from './features/toy/ToyPreferences';
import { Sleep } from './features/sleep/Sleep';
import { AppEntry } from './features/account/AppEntry';

export function App() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--visual-height', `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, []);
  return <PreviewProvider><ToyPreferencesProvider><div className={styles.canvas}>
    <div className={styles.app}><AppEntry><Routes><Route path="/" element={<Home />} /><Route path="/chat" element={<RequirePreview>{API_MODE === 'real' ? <LiveChat /> : <Chat />}</RequirePreview>} />
      <Route path="/login" element={<Login />} /><Route path="/settings" element={<Settings />} /><Route path="/help" element={<Help />} />
      <Route path="/malangi" element={<RequirePreview><Toy /></RequirePreview>} />
      <Route path="/sleep" element={<Sleep />} />
      <Route path="/results/:id" element={<RequirePreview><Result /></RequirePreview>} />
      <Route path="/archive" element={<RequirePreview><Archive /></RequirePreview>} />
      <Route path="/records/:id" element={<RequirePreview><RecordDetail /></RequirePreview>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AppEntry></div>

  </div></ToyPreferencesProvider></PreviewProvider>;
}
