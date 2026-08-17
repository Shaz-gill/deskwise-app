import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

// BrowserRouter must wrap App for react-router-dom's hooks (useNavigate,
// <Navigate>, <Route>, etc.) to work anywhere in the component tree.
createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <BrowserRouter>
         <App />
      </BrowserRouter>
   </StrictMode>
);
