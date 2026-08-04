import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Members from '@/pages/Members';
import MemberForm from '@/pages/MemberForm';
import MemberProfile from '@/pages/MemberProfile';
import Attendance from '@/pages/Attendance';
import Payments from '@/pages/Payments';
import Plans from '@/pages/Plans';
import Reports from '@/pages/Reports';
import AuditLog from '@/pages/AuditLog';
import UsersPage from '@/pages/Users';
import SettingsPage from '@/pages/Settings';
import CheckIn from '@/pages/CheckIn';

const AuthenticatedApp = () => {
  const { isLoadingAuth, authChecked } = useAuth();

  // Only show the full-screen spinner on the very first page load,
  // before we know if the user is logged in or not.
  // After that (authChecked=true), never block the UI again.
  if (!authChecked || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"           element={<Login />} />
      <Route path="/register"        element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/check-in"        element={<CheckIn />} />

      {/* Protected routes — redirect to /login if not authenticated */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/"                 element={<Dashboard />} />
          <Route path="/members"          element={<Members />} />
          <Route path="/members/new"      element={<MemberForm />} />
          <Route path="/members/:id/edit" element={<MemberForm />} />
          <Route path="/members/:id"      element={<MemberProfile />} />
          <Route path="/attendance"       element={<Attendance />} />
          <Route path="/payments"         element={<Payments />} />
          <Route path="/plans"            element={<Plans />} />
          <Route path="/reports"          element={<Reports />} />
          <Route path="/audit"            element={<AuditLog />} />
          <Route path="/users"            element={<UsersPage />} />
          <Route path="/settings"         element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
