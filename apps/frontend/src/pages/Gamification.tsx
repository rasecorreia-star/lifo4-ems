import { useState, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Star,
  Target,
  Flame,
  Crown,
  Award,
  TrendingUp,
  Users,
  Calendar,
  Gift,
  Zap,
  CheckCircle2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  target?: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  deadline: string;
  progress: number;
  target: number;
  type: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  points: number;
  level: number;
  avatar?: string;
}

// Mock data
const mockProfile = {
  userId: '1',
  totalPoints: 2450,
  level: 7,
  levelName: 'Expert',
  nextLevelPoints: 3000,
  currentStreak: 12,
  longestStreak: 24,
  achievementsUnlocked: 18,
  totalAchievements: 45,
  rank: 5,
  totalUsers: 128,
};

const mockAchievements: Achievement[] = [
  { id: '1', name: 'Primeiro Login', description: 'Faca seu primeiro login no sistema', icon: 'star', category: 'getting_started', points: 50, unlocked: true, unlockedAt: '2024-01-15' },
  { id: '2', name: 'Explorador', description: 'Visite todas as paginas do sistema', icon: 'compass', category: 'getting_started', points: 100, unlocked: true, unlockedAt: '2024-01-16' },
  { id: '3', name: 'Guardiao da Energia', description: 'Economize 1000 kWh em um mes', icon: 'zap', category: 'energy', points: 500, unlocked: true, unlockedAt: '2024-02-01' },
  { id: '4', name: 'Mestre do SOC', description: 'Mantenha SOC otimo por 30 dias', icon: 'battery', category: 'performance', points: 300, unlocked: false, progress: 22, target: 30 },
  { id: '5', name: 'Zero Alarmes', description: 'Passe 7 dias sem alarmes criticos', icon: 'shield', category: 'reliability', points: 250, unlocked: false, progress: 4, target: 7 },
  { id: '6', name: 'Analista de Dados', description: 'Gere 50 relatorios', icon: 'file', category: 'analytics', points: 200, unlocked: true, unlockedAt: '2024-02-10' },
  { id: '7', name: 'Eficiencia Maxima', description: 'Alcance 95% de eficiencia', icon: 'trending', category: 'performance', points: 400, unlocked: false, progress: 92, target: 95 },
  { id: '8', name: 'Veterano', description: 'Use o sistema por 365 dias', icon: 'calendar', category: 'loyalty', points: 1000, unlocked: false, progress: 45, target: 365 },
];

const mockChallenges: Challenge[] = [
  { id: '1', title: 'Desafio Semanal: Economia', description: 'Economize 500 kWh esta semana', reward: 150, deadline: '2024-02-18', progress: 320, target: 500, type: 'weekly' },
  { id: '2', title: 'Mantenha a Sequencia', description: 'Faca login por 5 dias consecutivos', reward: 100, deadline: '2024-02-20', progress: 3, target: 5, type: 'streak' },
  { id: '3', title: 'Relatorio Mensal', description: 'Gere o relatorio mensal completo', reward: 75, deadline: '2024-02-28', progress: 0, target: 1, type: 'monthly' },
];

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, userId: '101', userName: 'Carlos Silva', points: 5240, level: 12 },
  { rank: 2, userId: '102', userName: 'Ana Santos', points: 4890, level: 11 },
  { rank: 3, userId: '103', userName: 'Pedro Lima', points: 4120, level: 10 },
  { rank: 4, userId: '104', userName: 'Maria Costa', points: 3560, level: 9 },
  { rank: 5, userId: '1', userName: 'Voce', points: 2450, level: 7 },
  { rank: 6, userId: '105', userName: 'Joao Pereira', points: 2100, level: 6 },
  { rank: 7, userId: '106', userName: 'Lucia Ferreira', points: 1890, level: 6 },
  { rank: 8, userId: '107', userName: 'Ricardo Alves', points: 1650, level: 5 },
  { rank: 9, userId: '108', userName: 'Fernanda Souza', points: 1420, level: 5 },
  { rank: 10, userId: '109', userName: 'Bruno Oliveira', points: 1180, level: 4 },
];

const getIconComponent = (iconName: string) => {
  const icons: Record<string, React.ElementType> = {
    star: Star,
    compass: Target,
    zap: Zap,
    battery: Trophy,
    shield: Award,
    file: CheckCircle2,
    trending: TrendingUp,
    calendar: Calendar,
  };
  return icons[iconName] || Star;
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 h-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
};

export default function Gamification() {
  const [activeTab, setActiveTab] = useState('overview');
  const [profile] = useState(mockProfile);
  const [achievements] = useState(mockAchievements);
  const [challenges] = useState(mockChallenges);
  const [leaderboard] = useState(mockLeaderboard);

  const levelProgress = ((profile.totalPoints % 500) / 500) * 100;
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const inProgressAchievements = achievements.filter(a => !a.unlocked && a.progress);

  return (
    <div className="p-6">
      <PageHeader
        title="Gamificacao"
        description="Acompanhe seu progresso, conquistas e posicao no ranking"
      />

      {/* Profile Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nivel {profile.level}</p>
                <p className="text-2xl font-bold">{profile.levelName}</p>
                <Progress value={levelProgress} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.totalPoints} / {profile.nextLevelPoints} XP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sequencia Atual</p>
                <p className="text-2xl font-bold">{profile.currentStreak} dias</p>
                <p className="text-xs text-muted-foreground">Recorde: {profile.longestStreak} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conquistas</p>
                <p className="text-2xl font-bold">{profile.achievementsUnlocked}/{profile.totalAchievements}</p>
                <Progress value={(profile.achievementsUnlocked / profile.totalAchievements) * 100} className="h-2 mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ranking Global</p>
                <p className="text-2xl font-bold">#{profile.rank}</p>
                <p className="text-xs text-muted-foreground">de {profile.totalUsers} usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="achievements">Conquistas</TabsTrigger>
          <TabsTrigger value="challenges">Desafios</TabsTrigger>
          <TabsTrigger value="leaderboard">Ranking</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Challenges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Desafios Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {challenges.map(challenge => (
                    <div key={challenge.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{challenge.title}</p>
                          <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        </div>
                        <Badge variant="secondary">+{challenge.reward} XP</Badge>
                      </div>
                      <Progress value={(challenge.progress / challenge.target) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {challenge.progress}/{challenge.target} - Termina em {new Date(challenge.deadline).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Conquistas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {unlockedAchievements.slice(0, 4).map(achievement => {
                    const IconComponent = getIconComponent(achievement.icon);
                    return (
                      <div key={achievement.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{achievement.name}</p>
                          <p className="text-xs text-muted-foreground">{achievement.description}</p>
                        </div>
                        <Badge>+{achievement.points} XP</Badge>
                      </div>
                    );
                  })}
                </div>
                <Button variant="ghost" className="w-full mt-4" onClick={() => setActiveTab('achievements')}>
                  Ver todas as conquistas
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Top Leaderboard */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Top 5 do Ranking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {leaderboard.slice(0, 5).map(entry => (
                    <div
                      key={entry.userId}
                      className={cn(
                        "p-4 rounded-lg text-center",
                        entry.userId === '1' ? "bg-primary/20 ring-2 ring-primary" : "bg-muted/50"
                      )}
                    >
                      <div className="flex justify-center mb-2">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center">
                        <span className="text-lg font-bold">{entry.userName.charAt(0)}</span>
                      </div>
                      <p className="font-medium text-sm truncate">{entry.userName}</p>
                      <p className="text-xs text-muted-foreground">Nivel {entry.level}</p>
                      <p className="text-sm font-bold text-primary mt-1">{entry.points.toLocaleString()} XP</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          <div className="space-y-6">
            {/* In Progress */}
            {inProgressAchievements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Em Progresso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inProgressAchievements.map(achievement => {
                      const IconComponent = getIconComponent(achievement.icon);
                      const progress = achievement.progress && achievement.target
                        ? (achievement.progress / achievement.target) * 100
                        : 0;
                      return (
                        <div key={achievement.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <IconComponent className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{achievement.name}</p>
                              <Badge variant="secondary">+{achievement.points} XP</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {achievement.progress}/{achievement.target}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unlocked */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Desbloqueadas ({unlockedAchievements.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unlockedAchievements.map(achievement => {
                    const IconComponent = getIconComponent(achievement.icon);
                    return (
                      <div key={achievement.id} className="p-4 rounded-lg border bg-card border-green-500/30">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <IconComponent className="w-6 h-6 text-green-500" />
                          </div>
                          <div>
                            <p className="font-medium">{achievement.name}</p>
                            <Badge className="bg-green-500/20 text-green-500">+{achievement.points} XP</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        {achievement.unlockedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Desbloqueado em {new Date(achievement.unlockedAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Locked */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  Bloqueadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {achievements.filter(a => !a.unlocked && !a.progress).map(achievement => {
                    const IconComponent = getIconComponent(achievement.icon);
                    return (
                      <div key={achievement.id} className="p-4 rounded-lg border bg-muted/30 opacity-60">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <IconComponent className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{achievement.name}</p>
                            <Badge variant="outline">+{achievement.points} XP</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Challenges Tab */}
        <TabsContent value="challenges">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Desafios Semanais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {challenges.filter(c => c.type === 'weekly').map(challenge => (
                    <div key={challenge.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">{challenge.title}</p>
                          <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        </div>
                        <Badge className="bg-primary/20 text-primary">+{challenge.reward} XP</Badge>
                      </div>
                      <Progress value={(challenge.progress / challenge.target) * 100} className="h-3" />
                      <div className="flex justify-between mt-2 text-sm">
                        <span>{challenge.progress}/{challenge.target}</span>
                        <span className="text-muted-foreground">
                          Termina: {new Date(challenge.deadline).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Outros Desafios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {challenges.filter(c => c.type !== 'weekly').map(challenge => (
                    <div key={challenge.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">{challenge.title}</p>
                          <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        </div>
                        <Badge variant="secondary">+{challenge.reward} XP</Badge>
                      </div>
                      <Progress value={(challenge.progress / challenge.target) * 100} className="h-3" />
                      <div className="flex justify-between mt-2 text-sm">
                        <span>{challenge.progress}/{challenge.target}</span>
                        <span className="text-muted-foreground">
                          Termina: {new Date(challenge.deadline).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Ranking Global
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.map(entry => (
                  <div
                    key={entry.userId}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg",
                      entry.userId === '1' ? "bg-primary/20 ring-2 ring-primary" : "bg-muted/50"
                    )}
                  >
                    <div className="w-8 flex justify-center">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-lg font-bold">{entry.userName.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {entry.userName}
                        {entry.userId === '1' && <Badge className="ml-2" variant="secondary">Voce</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">Nivel {entry.level}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{entry.points.toLocaleString()} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
