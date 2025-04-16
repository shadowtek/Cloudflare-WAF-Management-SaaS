import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Shield, LogOut, Settings as SettingsIcon, Menu, X, History } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Changelog from './components/Changelog';
import WAFTemplates from './components/WAFTemplates';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setupSessionTimeout } from './lib/session';
import toast from 'react-hot-toast';

function SessionHandler() {
  const location = useLocation();
  
  useEffect(() => {
    if (location.search.includes('timeout=true')) {
      toast.error('Session expired. Please log in again.');
    }
  }, [location]);

  useEffect(() => {
    const cleanup = setupSessionTimeout();
    return () => cleanup();
  }, []);

  return null;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function Navigation() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const version = import.meta.env.PACKAGE_VERSION || '1.5.9';

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b border-orange-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-orange-600" />
            <div className="ml-2">
              <span className="text-xl font-semibold text-gray-900">
                WAFManager Pro
              </span>
              <Link to="/changelog" className="ml-2 text-sm text-gray-500 hover:text-gray-700">
                v{version}
              </Link>
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/templates"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-orange-50 focus:outline-none"
            >
              <Shield className="h-5 w-5 mr-2" />
              WAF Templates
            </Link>
            <Link
              to="/changelog"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-orange-50 focus:outline-none"
            >
              <History className="h-5 w-5 mr-2" />
              Changelog
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-orange-50 focus:outline-none"
            >
              <SettingsIcon className="h-5 w-5 mr-2" />
              Settings
            </Link>
            <button
              onClick={() => logout()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-orange-50 focus:outline-none"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 pt-4 pb-3">
            <div className="space-y-1">
              <Link
                to="/templates"
                className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-orange-50 rounded-md"
              >
                <div className="flex items-center">
                  <Shield className="h-5 w-5 mr-3" />
                  WAF Templates
                </div>
              </Link>
              <Link
                to="/changelog"
                className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-orange-50 rounded-md"
              >
                <div className="flex items-center">
                  <History className="h-5 w-5 mr-3" />
                  Changelog
                </div>
              </Link>
              <Link
                to="/settings"
                className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-orange-50 rounded-md"
              >
                <div className="flex items-center">
                  <SettingsIcon className="h-5 w-5 mr-3" />
                  Settings
                </div>
              </Link>
              <button
                onClick={() => logout()}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-orange-50 rounded-md"
              >
                <div className="flex items-center">
                  <LogOut className="h-5 w-5 mr-3" />
                  Logout
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <SessionHandler />
        <div className="min-h-screen bg-orange-50/30">
          <Navigation />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <PrivateRoute>
                  <WAFTemplates />
                </PrivateRoute>
              }
            />
            <Route
              path="/changelog"
              element={
                <PrivateRoute>
                  <Changelog />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;