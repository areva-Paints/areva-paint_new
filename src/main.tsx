import { AdminPage } from './admin/AdminPage';
import { ContentProvider } from './admin/ContentContext';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(window.location.pathname.replace(/\/$/,'') === '/admin' ? <AdminPage /> : <ContentProvider><App /></ContentProvider>);
