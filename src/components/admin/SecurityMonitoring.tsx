import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Eye,
  RefreshCw,
  Clock,
  User,
  Database,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SecurityMetrics {
  totalSessions: number;
  failedLogins: number;
  adminActions: number;
  dataAccess: number;
  lastAdminAccess: string | null;
  suspiciousActivity: number;
}

interface RecentActivity {
  id: string;
  action: string;
  user_id: string;
  resource_type: string;
  created_at: string;
  risk_level: 'low' | 'medium' | 'high';
  additional_data?: any;
}

export default function SecurityMonitoring() {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalSessions: 0,
    failedLogins: 0,
    adminActions: 0,
    dataAccess: 0,
    lastAdminAccess: null,
    suspiciousActivity: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { full_name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSecurityData();
    fetchUserProfiles();
    const interval = setInterval(fetchSecurityData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (!error && data) {
        const map: Record<string, { full_name: string }> = {};
        data.forEach(p => { map[p.user_id] = { full_name: p.full_name }; });
        setUserProfiles(map);
      }
    } catch {}
  };

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      
      await logSecurityAccess();

      const { data: auditLogs, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Could not fetch security logs:', error);
        return;
      }

      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = auditLogs?.filter(log => 
        new Date(log.created_at) > last24Hours
      ) || [];

      const adminActions = recent.filter(log => 
        log.action.includes('admin') || log.resource_type === 'user_management'
      );

      const dataAccessActions = recent.filter(log => 
        log.action.includes('data_access') || log.resource_type === 'data_access'
      );

      const suspiciousActions = recent.filter(log => 
        log.action.includes('failed') || 
        log.action.includes('suspicious') ||
        (log.additional_data && (() => {
          try {
            const parsed = JSON.parse(String(log.additional_data));
            return parsed.suspicious;
          } catch {
            return false;
          }
        })())
      );

      const lastAdminAccess = adminActions.length > 0 ? adminActions[0].created_at : null;

      setMetrics({
        totalSessions: recent.length,
        failedLogins: recent.filter(log => log.action.includes('failed')).length,
        adminActions: adminActions.length,
        dataAccess: dataAccessActions.length,
        lastAdminAccess,
        suspiciousActivity: suspiciousActions.length
      });

      const formattedActivity: RecentActivity[] = (auditLogs?.slice(0, 15) || []).map(log => ({
        id: log.id,
        action: log.action,
        user_id: log.user_id || 'system',
        resource_type: log.resource_type,
        created_at: log.created_at,
        risk_level: assessRiskLevel(log),
        additional_data: log.additional_data
      }));

      setRecentActivity(formattedActivity);
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const logSecurityAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('insert_security_audit_log', {
          p_action: 'security_monitoring_access',
          p_user_id: user.id,
          p_resource_type: 'security_monitoring',
          p_additional_data: JSON.stringify({
            timestamp: new Date().toISOString(),
            dashboard_section: 'security_monitoring'
          })
        });
      }
    } catch (error) {
      console.warn('Failed to log security access:', error);
    }
  };

  const assessRiskLevel = (log: any): 'low' | 'medium' | 'high' => {
    const action = log.action.toLowerCase();
    if (action.includes('failed') || action.includes('suspicious') || action.includes('delete') || action.includes('bulk_delete') || action.includes('reset_data')) return 'high';
    if (action.includes('admin') || action.includes('data_access') || action.includes('privilege') || action.includes('permission') || action.includes('block') || action.includes('role')) return 'medium';
    return 'low';
  };

  const getRiskConfig = (riskLevel: 'low' | 'medium' | 'high') => {
    switch (riskLevel) {
      case 'high':
        return { label: 'Alto', dotColor: 'bg-red-500', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' };
      case 'medium':
        return { label: 'Médio', dotColor: 'bg-amber-500', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' };
      default:
        return { label: 'Baixo', dotColor: 'bg-emerald-500', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' };
    }
  };

  const getActionLabel = (action: string): string => {
    const parsed = action.toLowerCase();
    let additionalInfo = '';
    try {
      const parts = action.split('_');
      if (parts.length >= 2) {
        const moduleMap: Record<string, string> = {
          users: 'Usuários', it: 'Equip. TI', inventory: 'Inventário',
          council: 'Conselho', system: 'Sistema', calendar: 'Calendário',
          permissions: 'Permissões', auth: 'Autenticação', security: 'Segurança',
          bookings: 'Agendamentos', user: 'Usuário',
        };
        additionalInfo = moduleMap[parts[0]] || '';
      }
    } catch {}
    
    if (parsed.includes('create') || parsed.includes('insert')) return `Criação${additionalInfo ? ` • ${additionalInfo}` : ''}`;
    if (parsed.includes('update') || parsed.includes('config_change')) return `Atualização${additionalInfo ? ` • ${additionalInfo}` : ''}`;
    if (parsed.includes('delete') || parsed.includes('bulk_delete')) return `Exclusão${additionalInfo ? ` • ${additionalInfo}` : ''}`;
    if (parsed.includes('login_success')) return 'Login realizado';
    if (parsed.includes('login_failed')) return 'Login falhou';
    if (parsed.includes('login')) return 'Login';
    if (parsed.includes('logout')) return 'Logout';
    if (parsed.includes('grant_role')) return 'Concessão de cargo';
    if (parsed.includes('revoke_role')) return 'Revogação de cargo';
    if (parsed.includes('block')) return 'Bloqueio de usuário';
    if (parsed.includes('unblock')) return 'Desbloqueio de usuário';
    if (parsed.includes('permission')) return 'Alteração de permissão';
    if (parsed.includes('monitoring_access')) return 'Acesso ao monitoramento';
    if (parsed.includes('reset_data')) return 'Reset de dados';
    if (parsed.includes('status_change')) return 'Alteração de status';
    if (parsed.includes('export')) return 'Exportação';
    if (parsed.includes('import')) return 'Importação';
    if (parsed.includes('access')) return 'Acesso';
    return action.replace(/_/g, ' ');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSecurityData();
  };

  const metricCards = [
    { label: 'Eventos (24h)', value: metrics.totalSessions, icon: Activity, gradient: 'from-blue-400 to-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400' },
    { label: 'Ações Admin', value: metrics.adminActions, icon: User, gradient: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Acesso a Dados', value: metrics.dataAccess, icon: Database, gradient: 'from-violet-400 to-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-400' },
    { label: 'Atividade Suspeita', value: metrics.suspiciousActivity, icon: AlertTriangle, gradient: 'from-red-400 to-red-600', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-600 dark:text-red-400', danger: true },
  ];

  if (loading) {
    return (
      <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-5 sm:p-6">
          <Skeleton className="h-6 w-64 bg-white/10" />
          <Skeleton className="h-4 w-48 bg-white/10 mt-2" />
        </div>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-5 sm:p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/[0.03] rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/[0.02] rounded-full blur-xl" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20 shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Monitoramento de Segurança
              </h2>
              <p className="text-slate-300/60 text-[11px] sm:text-xs font-medium tracking-wide">
                Vigilância em tempo real de eventos e ameaças do sistema
              </p>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full sm:w-auto rounded-xl bg-white text-slate-800 hover:bg-slate-100 shadow-lg h-9 text-xs font-semibold"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Security Status Indicator */}
        <div className={`rounded-xl p-3.5 flex items-center gap-3 ${
          metrics.suspiciousActivity > 0 
            ? 'bg-red-50 border border-red-200 dark:bg-red-900/10 dark:border-red-800' 
            : 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800'
        }`}>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            metrics.suspiciousActivity > 0 
              ? 'bg-red-100 dark:bg-red-900/30' 
              : 'bg-emerald-100 dark:bg-emerald-900/30'
          }`}>
            {metrics.suspiciousActivity > 0 ? (
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          <div>
            <p className={`text-xs font-bold ${
              metrics.suspiciousActivity > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              {metrics.suspiciousActivity > 0 
                ? `${metrics.suspiciousActivity} atividade(s) suspeita(s) detectada(s)`
                : 'Sistema seguro — nenhuma atividade suspeita'}
            </p>
            <p className={`text-[11px] font-medium ${
              metrics.suspiciousActivity > 0 ? 'text-red-600/60 dark:text-red-500/60' : 'text-emerald-600/60 dark:text-emerald-500/60'
            }`}>
              {metrics.suspiciousActivity > 0 
                ? 'Revise os logs imediatamente para investigar' 
                : 'Monitoramento ativo nas últimas 24 horas'}
            </p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="relative overflow-hidden rounded-xl border border-border/40 bg-card/95 shadow-sm">
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${card.gradient}`} />
                <div className="p-3.5 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{card.label}</span>
                    <div className={`h-7 w-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <Icon className={`h-3.5 w-3.5 ${card.text}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-extrabold ${card.danger && card.value > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Last Admin Access */}
        {metrics.lastAdminAccess && (
          <div className="rounded-xl border border-border/40 bg-muted/10 p-3 flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <Eye className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Último acesso admin: <span className="text-foreground font-semibold">{format(new Date(metrics.lastAdminAccess), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </p>
          </div>
        )}

        {/* Recent Activity Feed */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Clock className="h-3 w-3 text-slate-600 dark:text-slate-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Atividade Recente</span>
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-14 w-14 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Fingerprint className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade registrada</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentActivity.map((activity, idx) => {
                const risk = getRiskConfig(activity.risk_level);
                const userName = activity.user_id !== 'system' 
                  ? userProfiles[activity.user_id]?.full_name || 'Usuário' 
                  : 'Sistema';
                let description = '';
                try {
                  const parsed = activity.additional_data ? (typeof activity.additional_data === 'string' ? JSON.parse(activity.additional_data) : activity.additional_data) : {};
                  description = parsed?.description || '';
                } catch {}

                return (
                  <div key={activity.id} className="relative overflow-hidden rounded-lg border border-border/30 bg-card/80 hover:bg-muted/20 transition-colors group">
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
                      activity.risk_level === 'high' ? 'bg-red-500' :
                      activity.risk_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div className="p-3 pl-4 flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          activity.risk_level === 'high' ? 'bg-red-100 dark:bg-red-900/30' :
                          activity.risk_level === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
                        }`}>
                          <Lock className={`h-3.5 w-3.5 ${
                            activity.risk_level === 'high' ? 'text-red-600 dark:text-red-400' :
                            activity.risk_level === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold truncate">{getActionLabel(activity.action)}</span>
                          <Badge variant="outline" className={`text-[9px] font-bold gap-1 ${risk.className}`}>
                            <div className={`w-1 h-1 rounded-full ${risk.dotColor}`} />
                            {risk.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-medium">{userName}</span>
                          <span className="text-[10px] text-muted-foreground/40">•</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(activity.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                          {description && (
                            <>
                              <span className="text-[10px] text-muted-foreground/40">•</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}