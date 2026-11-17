import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles/global.css';

// Let fetch report offline failures instead of leaving a paused request without a recovery UI.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, networkMode: 'always' }, mutations: { retry: false, networkMode: 'always' } } });

async function start() {
  if ((import.meta.env.VITE_API_MODE ?? 'mock') !== 'mock') throw new Error('현재 버전은 예시 데이터 모드만 지원합니다.');
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
  createRoot(document.getElementById('root')!).render(
    <StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></StrictMode>,
  );
}
start().catch(() => {
  const root = document.getElementById('root')!;
  const title = document.createElement('h1'); title.textContent = '화면을 불러오지 못했어요';
  const text = document.createElement('p'); text.textContent = '브라우저의 사이트 설정을 확인한 뒤 다시 시도해 주세요.';
  const retry = document.createElement('button'); retry.textContent = '다시 불러오기'; retry.onclick = () => window.location.reload();
  root.className = 'bootError'; root.replaceChildren(title, text, retry);
});
