import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  'pt-BR': {
    translation: {
      // Common
      common: {
        loading: 'Carregando...',
        error: 'Erro',
        success: 'Sucesso',
        save: 'Salvar',
        cancel: 'Cancelar',
        delete: 'Excluir',
        edit: 'Editar',
        add: 'Adicionar',
        search: 'Buscar',
        filter: 'Filtrar',
        export: 'Exportar',
        back: 'Voltar',
        confirm: 'Confirmar',
        yes: 'Sim',
        no: 'Não',
        all: 'Todos',
        none: 'Nenhum',
        actions: 'Ações',
      },

      // Navigation
      nav: {
        dashboard: 'Dashboard',
        systems: 'Sistemas',
        alerts: 'Alertas',
        reports: 'Relatórios',
        settings: 'Configurações',
        profile: 'Perfil',
        logout: 'Sair',
      },

      // Auth
      auth: {
        login: 'Entrar',
        register: 'Registrar',
        email: 'Email',
        password: 'Senha',
        confirmPassword: 'Confirmar Senha',
        name: 'Nome',
        forgotPassword: 'Esqueceu a senha?',
        noAccount: 'Não tem conta?',
        hasAccount: 'Já tem conta?',
        loginError: 'Email ou senha inválidos',
        registerError: 'Erro ao registrar',
      },

      // Dashboard
      dashboard: {
        title: 'Dashboard',
        totalSystems: 'Total de Sistemas',
        online: 'Online',
        offline: 'Offline',
        errors: 'Erros',
        charging: 'Carregando',
        discharging: 'Descarregando',
        recentAlerts: 'Alertas Recentes',
        systemsOverview: 'Visão Geral',
      },

      // Systems
      systems: {
        title: 'Sistemas',
        addSystem: 'Adicionar Sistema',
        noSystems: 'Nenhum sistema encontrado',
        status: 'Status',
        lastUpdate: 'Última Atualização',
        details: 'Detalhes',
        telemetry: 'Telemetria',
        cells: 'Células',
        control: 'Controle',
        settings: 'Configurações',
        history: 'Histórico',
      },

      // Telemetry
      telemetry: {
        soc: 'Estado de Carga',
        soh: 'Saúde da Bateria',
        voltage: 'Tensão',
        current: 'Corrente',
        power: 'Potência',
        temperature: 'Temperatura',
        cells: 'Células',
        min: 'Mín',
        max: 'Máx',
        avg: 'Méd',
        charging: 'Carregando',
        discharging: 'Descarregando',
        idle: 'Ocioso',
        balancing: 'Balanceando',
      },

      // Control
      control: {
        operationMode: 'Modo de Operação',
        auto: 'Automático',
        manual: 'Manual',
        economic: 'Econômico',
        gridSupport: 'Suporte à Rede',
        maintenance: 'Manutenção',
        emergency: 'Emergência',
        startCharge: 'Iniciar Carga',
        stopCharge: 'Parar Carga',
        startDischarge: 'Iniciar Descarga',
        stopDischarge: 'Parar Descarga',
        emergencyStop: 'Parada de Emergência',
        resetAlarms: 'Resetar Alarmes',
        startBalance: 'Iniciar Balanceamento',
        stopBalance: 'Parar Balanceamento',
      },

      // Alerts
      alerts: {
        title: 'Alertas',
        noAlerts: 'Nenhum alerta',
        critical: 'Crítico',
        high: 'Alto',
        medium: 'Médio',
        low: 'Baixo',
        read: 'Lido',
        unread: 'Não Lido',
        acknowledge: 'Reconhecer',
        resolve: 'Resolver',
        markAsRead: 'Marcar como Lido',
      },

      // Reports
      reports: {
        title: 'Relatórios',
        generate: 'Gerar Relatório',
        daily: 'Diário',
        weekly: 'Semanal',
        monthly: 'Mensal',
        custom: 'Personalizado',
        download: 'Baixar',
        period: 'Período',
        startDate: 'Data Inicial',
        endDate: 'Data Final',
      },

      // Settings
      settings: {
        title: 'Configurações',
        protection: 'Proteções',
        notifications: 'Notificações',
        schedules: 'Agendamentos',
        system: 'Sistema',
        about: 'Sobre',
      },

      // Validation
      validation: {
        required: 'Campo obrigatório',
        invalidEmail: 'Email inválido',
        minLength: 'Mínimo de {{min}} caracteres',
        maxLength: 'Máximo de {{max}} caracteres',
        passwordMismatch: 'Senhas não conferem',
      },

      // Errors
      errors: {
        generic: 'Ocorreu um erro. Tente novamente.',
        network: 'Erro de conexão. Verifique sua internet.',
        notFound: 'Recurso não encontrado.',
        unauthorized: 'Acesso não autorizado.',
        forbidden: 'Acesso negado.',
      },
    },
  },
  en: {
    translation: {
      common: {
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        search: 'Search',
        filter: 'Filter',
        export: 'Export',
        back: 'Back',
        confirm: 'Confirm',
        yes: 'Yes',
        no: 'No',
        all: 'All',
        none: 'None',
        actions: 'Actions',
      },
      nav: {
        dashboard: 'Dashboard',
        systems: 'Systems',
        alerts: 'Alerts',
        reports: 'Reports',
        settings: 'Settings',
        profile: 'Profile',
        logout: 'Logout',
      },
      // ... (shortened for brevity, same structure as pt-BR)
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
