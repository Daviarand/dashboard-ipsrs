import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { Layout } from '@/app/Layout';
import { MissingConfigPage } from '@/features/misc/MissingConfigPage';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { UserRole } from '@/features/auth/AuthContext';

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const RoomsPage = lazy(() => import('@/features/master/RoomsPage').then((module) => ({ default: module.RoomsPage })));
const DamageTypesPage = lazy(() => import('@/features/master/DamageTypesPage').then((module) => ({ default: module.DamageTypesPage })));
const FailureReasonsPage = lazy(() => import('@/features/master/FailureReasonsPage').then((module) => ({ default: module.FailureReasonsPage })));
const UsersPage = lazy(() => import('@/features/master/UsersPage').then((module) => ({ default: module.UsersPage })));
const TicketCreatePage = lazy(() => import('@/features/tickets/TicketCreatePage').then((module) => ({ default: module.TicketCreatePage })));
const TicketListPage = lazy(() => import('@/features/tickets/TicketListPage').then((module) => ({ default: module.TicketListPage })));
const TicketDetailPage = lazy(() => import('@/features/tickets/TicketDetailPage').then((module) => ({ default: module.TicketDetailPage })));
const TicketPrintPage = lazy(() => import('@/features/tickets/TicketPrintPage').then((module) => ({ default: module.TicketPrintPage })));
const TaskPage = lazy(() => import('@/features/tasks/TaskPage').then((module) => ({ default: module.TaskPage })));
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage').then((module) => ({ default: module.InventoryPage })));
const ActivityLogPage = lazy(() => import('@/features/activity/ActivityLogPage').then((module) => ({ default: module.ActivityLogPage })));
const ProfilePage = lazy(() => import('@/features/auth/ProfilePage').then((module) => ({ default: module.ProfilePage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">
      Memuat aplikasi...
    </main>
  );
}

function RequireAuth({ roles }: { roles?: UserRole[] }) {
  const { profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={profile.role === 'teknisi' ? '/tugas' : '/'} replace />;
  }
  return <Outlet />;
}

function SignedInRedirect() {
  const { profile, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!profile) return <LoginPage />;
  return <Navigate to={profile.role === 'teknisi' ? '/tugas' : '/'} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<SignedInRedirect />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<HomeRedirect />} />
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="tiket" element={<TicketListPage />} />
              <Route path="tiket/baru" element={<TicketCreatePage />} />
              <Route path="master/ruangan" element={<RoomsPage />} />
              <Route path="master/jenis-kerusakan" element={<DamageTypesPage />} />
              <Route path="master/alasan-gagal" element={<FailureReasonsPage />} />
              <Route path="master/pengguna" element={<UsersPage />} />
              <Route path="log" element={<ActivityLogPage />} />
              <Route path="tiket/:id/cetak" element={<TicketPrintPage />} />
            </Route>
            <Route path="tiket/:id" element={<TicketDetailPage />} />
            <Route path="persediaan" element={<InventoryPage />} />
            <Route path="profil" element={<ProfilePage />} />
            <Route element={<RequireAuth roles={['teknisi']} />}>
              <Route path="tugas" element={<TaskPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

function HomeRedirect() {
  const { profile } = useAuth();
  return <Navigate to={profile?.role === 'teknisi' ? '/tugas' : '/dashboard'} replace />;
}

export function App() {
  if (!isSupabaseConfigured) return <MissingConfigPage />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
