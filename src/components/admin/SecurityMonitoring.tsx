import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Eye, 
  EyeOff,
  RefreshCw,
  Clock,
  User,
  Database,
  Lock
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSecurityData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchSecurityData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      
      // Log this security monitoring access
      await logSecurityAccess();

      // Fetch recent audit logs
      const { data: auditLogs, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Could not fetch security logs:', error);
        return;
      }

      // Calculate security metrics
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

      // Identify suspicious patterns
      const suspiciousActions = recent.filter(log => 
        log.action.includes('failed') || 
        log.action.includes('suspicious') ||
        (log.additional_data && JSON.parse(String(log.additional_data)).suspicious)
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

      // Format recent activity with risk assessment
      const formattedActivity: RecentActivity[] = (auditLogs?.slice(0, 10) || []).map(log => ({
        id: log.id,
        action: log.action,
        user_id: log.user_id || 'system',
        resource_type: log.resource_type,
        created_at: log.created_at,
        risk_level: assessRiskLevel(log)
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
    
    if (action.includes('failed') || action.includes('suspicious') || action.includes('delete')) {
      return 'high';
    }
    
    if (action.includes('admin') || action.includes('data_access') || action.includes('privilege')) {
      return 'medium';
    }
    
    return 'low';
  };

  const getRiskBadge = (riskLevel: 'low' | 'medium' | 'high') => {
    switch (riskLevel) {
      case 'high':
        return <Badge variant="destructive">Alto Risco</Badge>;
      case 'medium':
        return <Badge variant="secondary">Médio Risco</Badge>;
      default:
        return <Badge variant="outline">Baixo Risco</Badge>;
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSecurityData();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Monitoramento de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sessões (24h)</p>
                <p className="text-2xl font-bold">{metrics.totalSessions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ações Admin</p>
                <p className="text-2xl font-bold">{metrics.adminActions}</p>
              </div>
              <User className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acesso a Dados</p>
                <p className="text-2xl font-bold">{metrics.dataAccess}</p>
              </div>
              <Database className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atividade Suspeita</p>
                <p className="text-2xl font-bold text-red-500">{metrics.suspiciousActivity}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {metrics.suspiciousActivity > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700">
            {metrics.suspiciousActivity} atividade(s) suspeita(s) detectada(s) nas últimas 24 horas. 
            Revise os logs imediatamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma atividade registrada
              </p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{activity.action}</span>
                      {getRiskBadge(activity.risk_level)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activity.resource_type} • {format(new Date(activity.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </div>
                  </div>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last Admin Access */}
      {metrics.lastAdminAccess && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Último acesso admin: {format(new Date(metrics.lastAdminAccess), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}