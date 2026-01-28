import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Battery,
  Bell,
  FileText,
  Settings,
  LogOut,
  X,
  Zap,
  TrendingUp,
  Sliders,
  Users,
  Network,
  ShieldAlert,
  Wrench,
  History,
  Cpu,
  Key,
  HelpCircle,
  Activity,
  DollarSign,
  CloudSun,
  Heart,
  Leaf,
  Radio,
  Brain,
  Award,
  Shield,
  Package,
  Rocket,
  Scale,
  Globe,
  Home,
  Layers,
  Terminal,
  Plug,
  Target,
  GraduationCap,
  BookOpen,
  LifeBuoy,
  Archive,
  KeyRound,
  MonitorSmartphone,
  ScrollText,
  CalendarClock,
  FileSignature,
  ClipboardList,
  Box,
  MailOpen,
  Upload,
  Car,
  Camera,
  Grid3X3,
  UserPlus,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  mobile?: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[]; // If defined, only these roles can see this item
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Multi-Site', href: '/multi-site', icon: Layers, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Meu Sistema', href: '/my-system', icon: Home, roles: [UserRole.USER] },
  { name: 'Sistemas', href: '/systems', icon: Battery },
  { name: 'Carregadores EV', href: '/ev-chargers', icon: Car, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Cameras', href: '/cameras', icon: Camera, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Microgrids', href: '/microgrids', icon: Grid3X3, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Prospects', href: '/prospects', icon: UserPlus, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] },
  { name: 'Benchmarking', href: '/benchmarking', icon: Award, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Gamificacao', href: '/gamification', icon: Trophy, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'SLA', href: '/sla', icon: Target, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Saude Bateria', href: '/battery-health', icon: Heart, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] },
  { name: 'Perfil de Carga', href: '/load-profile', icon: Activity, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Custos Energia', href: '/energy-costs', icon: DollarSign, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Meteorologia', href: '/weather', icon: CloudSun, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Otimizacao', href: '/optimization', icon: Sliders, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Simulacao', href: '/simulation', icon: Sliders, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Digital Twin', href: '/digital-twin', icon: Sparkles, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Integracao Rede', href: '/grid', icon: Network, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'VPP', href: '/vpp', icon: Globe, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Resp. Demanda', href: '/demand-response', icon: Radio, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Trading', href: '/trading', icon: TrendingUp, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Trading IA', href: '/trading-dashboard', icon: Brain, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Assistente IA', href: '/assistant', icon: Sparkles },
  { name: 'Black Start', href: '/blackstart', icon: ShieldAlert, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Alertas', href: '/alerts', icon: Bell },
  { name: 'Config. Alarmes', href: '/alarm-config', icon: Settings, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Relatorios', href: '/reports', icon: FileText },
  { name: 'Pegada Carbono', href: '/carbon', icon: Leaf, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Manutencao', href: '/maintenance', icon: Wrench, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] },
  { name: 'Garantias', href: '/warranties', icon: Shield, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Inventario', href: '/inventory', icon: Package, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Comissionamento', href: '/commissioning', icon: Rocket, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Conformidade', href: '/compliance', icon: Scale, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Manut. Preditiva', href: '/predictive', icon: Brain, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Diag. Remoto', href: '/remote-diagnostics', icon: Terminal, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TECHNICIAN] },
  { name: 'Log de Eventos', href: '/events', icon: History, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Firmware', href: '/firmware', icon: Cpu, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'API Keys', href: '/api-keys', icon: Key, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Integracoes', href: '/integrations', icon: Plug, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Auditoria', href: '/audit', icon: ShieldAlert, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Backup', href: '/backup', icon: Archive, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Licenca', href: '/license', icon: KeyRound, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Sessoes', href: '/sessions', icon: MonitorSmartphone, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Logs Sistema', href: '/logs', icon: ScrollText, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Rede', href: '/network', icon: Network, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Tarefas', href: '/tasks', icon: CalendarClock, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Contratos', href: '/contracts', icon: FileSignature, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Ordens Servico', href: '/work-orders', icon: ClipboardList, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] },
  { name: 'Ativos', href: '/assets', icon: Box, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
  { name: 'Templates Notif.', href: '/notification-templates', icon: MailOpen, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Importar Dados', href: '/data-import', icon: Upload, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Usuarios', href: '/users', icon: Users, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  { name: 'Configuracoes', href: '/settings', icon: Settings },
  { name: 'Treinamentos', href: '/training', icon: GraduationCap, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] },
  { name: 'Documentacao', href: '/docs', icon: BookOpen },
  { name: 'Suporte', href: '/support', icon: LifeBuoy },
  { name: 'Ajuda', href: '/help', icon: HelpCircle },
];

export default function Sidebar({ onClose, mobile }: SidebarProps) {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col',
        mobile ? 'animate-slide-in' : 'hidden lg:flex'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <span className="font-bold text-lg text-foreground">Lifo4</span>
            <span className="text-primary font-semibold ml-1">EMS</span>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation
          .filter((item) => {
            // MODO DEMO: Mostrar todos os menus
            const isDemoMode = true;
            if (isDemoMode) return true;
            // If no roles defined, show to everyone
            if (!item.roles) return true;
            // If roles defined, check if user has one of them
            return user && item.roles.includes(user.role as UserRole);
          })
          .map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={mobile ? onClose : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-medium">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-foreground-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-muted hover:text-danger-500 hover:bg-danger-500/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
