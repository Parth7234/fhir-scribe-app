import { useEffect } from 'react';
import { Navigate, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ScribePage from './pages/ScribePage';
import ReportDetailPage from './pages/ReportDetailPage';
import { Loader2 } from 'lucide-react';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function DashboardRouter() {
  const { userProfile, loading } = useAuth();

  console.log('[ROUTER] DashboardRouter:', { role: userProfile?.role, loading });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (userProfile?.role === 'admin') {
    return <AdminDashboard />;
  }

  if (userProfile?.role === 'patient') {
    return <PatientDashboard />;
  }

  return <DoctorDashboard />;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let backButtonListener: any = null;

    const setupBackButton = async () => {
      try {
        backButtonListener = await CapacitorApp.addListener('backButton', (data) => {
          console.log('[Capacitor] Hardware back button pressed. Path:', location.pathname);

          // Exit the app if we are on a root-level main page
          const isMainPage = [
            '/dashboard',
            '/login',
            '/register',
            '/admin'
          ].includes(location.pathname);

          if (isMainPage || !data.canGoBack) {
            CapacitorApp.exitApp();
          } else {
            // Otherwise, navigate back in the internal history stack
            navigate(-1);
          }
        });
      } catch (err) {
        console.warn('Capacitor App plugin is not available on this platform:', err);
      }
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [location.pathname, navigate]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
      <Route path="/register" element={<AuthRedirect><RegisterPage /></AuthRedirect>} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/scribe" element={<ProtectedRoute><ScribePage /></ProtectedRoute>} />
      <Route path="/report/:id" element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
