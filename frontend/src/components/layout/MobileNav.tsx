import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Battery, Bell, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sistemas', href: '/systems', icon: Battery },
  { name: 'Alertas', href: '/alerts', icon: Bell },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Perfil', href: '/profile', icon: User },
];

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-full h-full px-2 transition-colors',
                isActive ? 'text-primary' : 'text-foreground-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('w-5 h-5 mb-1', isActive && 'scale-110')} />
                <span className="text-2xs font-medium">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
