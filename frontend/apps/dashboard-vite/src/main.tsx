import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import dayjs from 'dayjs';
import App from './App';
import 'antd/dist/reset.css';
import './styles/index.css';
import { useThemeStore } from './store/theme';

dayjs.locale('en');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 60_000
    }
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);

function RootApp() {
  const mode = useThemeStore((state) => state.mode);
  const algorithms = mode === 'dark' ? [theme.darkAlgorithm] : [theme.defaultAlgorithm];
  const token = mode === 'dark'
    ? {
        colorPrimary: '#60a5fa',
        colorInfo: '#60a5fa',
        colorBgLayout: '#0f172a',
        colorBgContainer: '#111c33',
        colorText: '#e2e8f0',
        colorTextSecondary: '#94a3b8',
        borderRadius: 10,
        fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif'
      }
    : {
        colorPrimary: '#2563eb',
        colorInfo: '#2563eb',
        colorBgLayout: '#f4f7fb',
        colorBgContainer: '#ffffff',
        colorText: '#1f2937',
        colorTextSecondary: '#475569',
        borderRadius: 10,
        fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif'
      };

  return (
    <ConfigProvider
      locale={enUS}
      theme={{
        algorithm: algorithms,
        token,
        components: {
          Card: { borderRadiusLG: 16 }
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AntdApp>
            <App />
          </AntdApp>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
