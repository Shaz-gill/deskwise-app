import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/routes/ProtectedRoute';
import { GuestRoute } from './components/routes/GuestRoute';
import { AdminRoute } from './components/routes/AdminRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { UsersPage } from './pages/UsersPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';

function App() {
   return (
      <Routes>
         <Route
            path="/login"
            element={
               <GuestRoute>
                  <LoginPage />
               </GuestRoute>
            }
         />
         <Route
            path="/"
            element={
               <ProtectedRoute>
                  <Layout>
                     <HomePage />
                  </Layout>
               </ProtectedRoute>
            }
         />
         <Route
            path="/tickets"
            element={
               <ProtectedRoute>
                  <Layout>
                     <TicketsPage />
                  </Layout>
               </ProtectedRoute>
            }
         />
         <Route
            path="/tickets/:id"
            element={
               <ProtectedRoute>
                  <Layout>
                     <TicketDetailPage />
                  </Layout>
               </ProtectedRoute>
            }
         />
         <Route
            path="/users"
            element={
               <ProtectedRoute>
                  <AdminRoute>
                     <Layout>
                        <UsersPage />
                     </Layout>
                  </AdminRoute>
               </ProtectedRoute>
            }
         />
      </Routes>
   );
}

export default App;
