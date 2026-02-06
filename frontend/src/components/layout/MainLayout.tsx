import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import NotificationToast from '@/components/notifications/NotificationToast';
import { useAuthStore } from '@/store/auth.store';
import { socketService } from '@/services/socket';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (accessToken) {
      socketService.connect(accessToken);
    }

    return () => {
      socketService.disconnect();
    };
  }, [accessToken]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Logo with 30% opacity - full screen */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.3 }}
      >
        <img
          src="/logo.png"
          alt=""
          className="w-full h-full object-contain"
          style={{ filter: 'grayscale(50%)' }}
        />
      </div>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar open={true} onClose={() => setSidebarOpen(false)} mobile />
        </div>
      )}

      {/* Main Content */}
      <div className={`${!isMobile ? 'lg:pl-64' : ''} flex flex-col min-h-screen`}>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileNav />}

      {/* Notification Toast */}
      <NotificationToast />
    </div>
  );
}
