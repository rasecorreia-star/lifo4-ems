import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Zap,
  Battery,
  Pause,
  TrendingDown,
  Loader2,
  AlertTriangle,
  X,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { systemsApi, controlApi } from '@/services/api';
import { BessSystem, Schedule, ScheduleAction } from '@/types';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const ACTION_CONFIG = {
  [ScheduleAction.CHARGE]: {
    label: 'Carregar',
    icon: Zap,
    color: 'text-success-500',
    bgColor: 'bg-success-500/10',
  },
  [ScheduleAction.DISCHARGE]: {
    label: 'Descarregar',
    icon: Battery,
    color: 'text-warning-500',
    bgColor: 'bg-warning-500/10',
  },
  [ScheduleAction.IDLE]: {
    label: 'Ocioso',
    icon: Pause,
    color: 'text-foreground-muted',
    bgColor: 'bg-surface-hover',
  },
  [ScheduleAction.PEAK_SHAVING]: {
    label: 'Peak Shaving',
    icon: TrendingDown,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
};

export default function SystemSchedules() {
  const { systemId } = useParams<{ systemId: string }>();
  const [system, setSystem] = useState<BessSystem | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Fetch data
  const fetchData = async () => {
    if (!systemId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [systemRes, schedulesRes] = await Promise.all([
        systemsApi.getById(systemId),
        controlApi.getSchedules(systemId),
      ]);

      setSystem(systemRes.data.data || null);
      setSchedules(schedulesRes.data.data || []);
    } catch (err) {
      setError('Falha ao carregar agendamentos');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [systemId]);

  // Delete schedule
  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    try {
      await controlApi.deleteSchedule(scheduleId);
      setSchedules(schedules.filter((s) => s.id !== scheduleId));
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  // Toggle schedule active
  const handleToggle = async (schedule: Schedule) => {
    try {
      await controlApi.updateSchedule(schedule.id, { isActive: !schedule.isActive });
      setSchedules(
        schedules.map((s) =>
          s.id === schedule.id ? { ...s, isActive: !s.isActive } : s
        )
      );
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  // Open edit modal
  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowModal(true);
  };

  // Open new modal
  const handleNew = () => {
    setEditingSchedule(null);
    setShowModal(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
  };

  // Save schedule
  const handleSave = async (data: Partial<Schedule>) => {
    try {
      if (editingSchedule) {
        await controlApi.updateSchedule(editingSchedule.id, data);
        setSchedules(
          schedules.map((s) =>
            s.id === editingSchedule.id ? { ...s, ...data } : s
          )
        );
      } else {
        const res = await controlApi.createSchedule({ ...data, systemId });
        if (res.data.data) {
          setSchedules([...schedules, res.data.data]);
        }
      }
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !system) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {error || 'Sistema não encontrado'}
        </h2>
        <Link
          to="/systems"
          className="text-primary hover:text-primary-400 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para sistemas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/systems/${systemId}`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-muted" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-foreground-muted text-sm">
              {system.name} • Programações de carga e descarga
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Agendamento
        </button>
      </div>

      {/* Schedules Grid */}
      {schedules.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum agendamento configurado
          </h3>
          <p className="text-foreground-muted mb-6">
            Crie agendamentos para automatizar cargas e descargas
          </p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Criar Primeiro Agendamento
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onToggle={() => handleToggle(schedule)}
              onEdit={() => handleEdit(schedule)}
              onDelete={() => handleDelete(schedule.id)}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Tipos de Ação
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(ACTION_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div
                key={key}
                className="bg-background rounded-lg border border-border p-4"
              >
                <div className={cn('inline-flex p-2 rounded-lg mb-2', config.bgColor)}>
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>
                <h4 className="font-medium text-foreground">{config.label}</h4>
                <p className="text-xs text-foreground-muted mt-1">
                  {key === ScheduleAction.CHARGE && 'Inicia carga da bateria'}
                  {key === ScheduleAction.DISCHARGE && 'Inicia descarga da bateria'}
                  {key === ScheduleAction.IDLE && 'Mantém bateria em standby'}
                  {key === ScheduleAction.PEAK_SHAVING && 'Reduz picos de demanda'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ScheduleModal
          schedule={editingSchedule}
          onSave={handleSave}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

// Schedule Card
interface ScheduleCardProps {
  schedule: Schedule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ScheduleCard({ schedule, onToggle, onEdit, onDelete }: ScheduleCardProps) {
  const config = ACTION_CONFIG[schedule.action] || ACTION_CONFIG[ScheduleAction.IDLE];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'bg-surface rounded-xl border p-4 transition-all',
        schedule.isActive ? 'border-border' : 'border-border opacity-60'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', config.bgColor)}>
            <Icon className={cn('w-5 h-5', config.color)} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{schedule.name}</h3>
            <p className={cn('text-sm', config.color)}>{config.label}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          {schedule.isActive ? (
            <ToggleRight className="w-8 h-8 text-success-500" />
          ) : (
            <ToggleLeft className="w-8 h-8" />
          )}
        </button>
      </div>

      <div className="space-y-3 mb-4">
        {/* Time */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-foreground-muted" />
          <span className="text-foreground">
            {schedule.startTime} - {schedule.endTime}
          </span>
        </div>

        {/* Days */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-foreground-muted" />
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((day) => (
              <span
                key={day.value}
                className={cn(
                  'w-7 h-7 flex items-center justify-center text-xs font-medium rounded-full',
                  schedule.daysOfWeek.includes(day.value)
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-foreground-muted'
                )}
              >
                {day.label.charAt(0)}
              </span>
            ))}
          </div>
        </div>

        {/* Target SOC */}
        {schedule.targetSoc !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <Battery className="w-4 h-4 text-foreground-muted" />
            <span className="text-foreground">Meta SOC: {schedule.targetSoc}%</span>
          </div>
        )}

        {/* Power Limit */}
        {schedule.powerLimit !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-foreground-muted" />
            <span className="text-foreground">Limite: {schedule.powerLimit}W</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <button
          onClick={onEdit}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-danger-500/10 rounded-lg transition-colors text-foreground-muted hover:text-danger-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Schedule Modal
interface ScheduleModalProps {
  schedule: Schedule | null;
  onSave: (data: Partial<Schedule>) => void;
  onClose: () => void;
}

function ScheduleModal({ schedule, onSave, onClose }: ScheduleModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(schedule?.name || '');
  const [action, setAction] = useState<ScheduleAction>(schedule?.action || ScheduleAction.CHARGE);
  const [startTime, setStartTime] = useState(schedule?.startTime || '08:00');
  const [endTime, setEndTime] = useState(schedule?.endTime || '18:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(schedule?.daysOfWeek || [1, 2, 3, 4, 5]);
  const [targetSoc, setTargetSoc] = useState(schedule?.targetSoc || 80);
  const [powerLimit, setPowerLimit] = useState(schedule?.powerLimit || 5000);
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSave({
        name,
        action,
        startTime,
        endTime,
        daysOfWeek,
        targetSoc,
        powerLimit,
        isActive,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-xl border border-border w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {schedule ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Carga noturna"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Ação
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ACTION_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAction(key as ScheduleAction)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 rounded-lg border transition-all',
                      action === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Início
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Fim
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Days of Week */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Dias da Semana
            </label>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    daysOfWeek.includes(day.value)
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target SOC */}
          {(action === ScheduleAction.CHARGE || action === ScheduleAction.DISCHARGE) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Meta SOC: {targetSoc}%
              </label>
              <input
                type="range"
                value={targetSoc}
                onChange={(e) => setTargetSoc(parseInt(e.target.value))}
                min={10}
                max={100}
                className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          )}

          {/* Power Limit */}
          {action === ScheduleAction.PEAK_SHAVING && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Limite de Potência (W)
              </label>
              <input
                type="number"
                value={powerLimit}
                onChange={(e) => setPowerLimit(parseInt(e.target.value))}
                min={0}
                max={50000}
                step={100}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-foreground">Ativo</span>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className="text-foreground-muted hover:text-foreground transition-colors"
            >
              {isActive ? (
                <ToggleRight className="w-10 h-10 text-success-500" />
              ) : (
                <ToggleLeft className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-surface-hover hover:bg-surface-active text-foreground font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !name || daysOfWeek.length === 0}
              className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
