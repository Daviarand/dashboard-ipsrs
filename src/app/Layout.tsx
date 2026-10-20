import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import {
  LayoutDashboard,
  Ticket,
  CheckSquare,
  Package,
  Layers,
  History,
  User,
  LogOut,
  Menu,
  X,
  Wrench,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Layout() {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [masterMenuOpen, setMasterMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-semibold'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  const subNavItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
      isActive
        ? 'text-blue-700 font-semibold bg-blue-50/50'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 leading-tight">IPSRS</h1>
            <p className="text-[10px] text-slate-500 leading-none">RS. Soeharto Heerdjan</p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:z-auto ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-slate-900 truncate">IPSRS Dashboard</h1>
            <p className="text-[11px] text-slate-500 truncate">RS. Soeharto Heerdjan</p>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-800 truncate">{profile?.full_name}</p>
            <p className="text-[11px] text-slate-500 capitalize">
              Peran: <span className="font-medium text-blue-600">{role === 'admin' ? 'Admin' : 'Teknisi'}</span>
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {role === 'admin' ? (
            <>
              <NavLink to="/" end className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/tiket" className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
                <Ticket className="h-4 w-4" />
                <span>Daftar Tiket</span>
              </NavLink>

              <NavLink to="/persediaan" className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
                <Package className="h-4 w-4" />
                <span>Persediaan Material</span>
              </NavLink>

              {/* Collapsible Master Data */}
              <div>
                <button
                  type="button"
                  onClick={() => setMasterMenuOpen(!masterMenuOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4" />
                    <span>Data Master</span>
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      masterMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {masterMenuOpen && (
                  <div className="pl-6 pt-1 space-y-0.5">
                    <NavLink
                      to="/master/ruangan"
                      className={subNavItemClass}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Ruangan
                    </NavLink>
                    <NavLink
                      to="/master/jenis-kerusakan"
                      className={subNavItemClass}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Jenis Kerusakan
                    </NavLink>
                    <NavLink
                      to="/master/alasan-gagal"
                      className={subNavItemClass}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Alasan Gagal Laksana
                    </NavLink>
                    <NavLink
                      to="/master/pengguna"
                      className={subNavItemClass}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Akun Teknisi
                    </NavLink>
                  </div>
                )}
              </div>

              <NavLink to="/log" className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
                <History className="h-4 w-4" />
                <span>Log Aktivitas</span>
              </NavLink>
            </>
          ) : (
            <>
              {/* Menu Teknisi */}
              <NavLink to="/tugas" className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
                <CheckSquare className="h-4 w-4" />
                <span>Tugas Saya</span>
              </NavLink>

              <NavLink to="/persediaan" className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
                <Package className="h-4 w-4" />
                <span>Persediaan Material</span>
              </NavLink>
            </>
          )}

          <div className="pt-2 border-t border-slate-100 mt-2">
            <NavLink to="/profil" className={navItemClass} onClick={() => setMobileMenuOpen(false)}>
              <User className="h-4 w-4" />
              <span>Profil & Sandi</span>
            </NavLink>
          </div>
        </nav>

        {/* Sidebar Footer with Logout */}
        <div className="p-3 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>Keluar</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-white md:m-2 md:rounded-xl md:border md:border-slate-200/80 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
