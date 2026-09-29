import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminRoute } from './components/routes/AdminRoute';
import { GuestRoute } from './components/routes/GuestRoute';
import { ProtectedRoute } from './components/routes/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketsPage } from './pages/TicketsPage';
import { UsersPage } from './pages/UsersPage';

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
         <Route path="/" element={<Navigate to="/dashboard" replace />} />
         <Route
            path="/dashboard"
            element={
               <ProtectedRoute>
                  <Layout>
                     <DashboardPage />
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
         <Route
            path="/settings"
            element={
               <ProtectedRoute>
                  <AdminRoute>
                     <Layout>
                        <SettingsPage />
                     </Layout>
                  </AdminRoute>
               </ProtectedRoute>
            }
         />
      </Routes>
   );
}

export default App;
