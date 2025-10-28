import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { appRoutes } from './routes';

function RoutedContent() {
  return (
    <Routes>
      {appRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
}

export default function App() {
  return (
    <AppLayout>
      <RoutedContent />
    </AppLayout>
  );
}
