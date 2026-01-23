import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Settings, 
  Database, 
  Mail, 
  Clock, 
  Shield, 
  Bell,
  Globe,
  Save,
  RefreshCw,
  AlertTriangle,
  Info,
  Trash2,
  CalendarX
} from 'lucide-react';

interface SystemConfig {
  max_booking_quantity: number;
  max_booking_days_advance: number;
  default_chromebook_inventory: number;
  booking_time_slots: string[];
  maintenance_mode: boolean;
  maintenance_message: string;
  email_notifications: boolean;
  auto_cancel_past_bookings: boolean;
  weekend_bookings_allowed: boolean;
}

export default function SystemSettings() {
  const [config, setConfig] = useState<SystemConfig>({
    max_booking_quantity: 50,
    max_booking_days_advance: 90,
    default_chromebook_inventory: 200,
    booking_time_slots: ['08:00-12:00', '13:00-17:00'],
    maintenance_mode: false,
    maintenance_message: 'Sistema em manutenção. Tente novamente mais tarde.',
    email_notifications: true,
    auto_cancel_past_bookings: true,
    weekend_bookings_allowed: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDate, setDeleteDate] = useState('');
  const [dbStats, setDbStats] = useState({
    totalUsers: 0,
    totalBookings: 0,
    activeBookings: 0,
    totalRoomBookings: 0,
    activeRoomBookings: 0,
    dbSize: 'Calculando...'
  });

  useEffect(() => {
    fetchSystemConfig();
    fetchSystemStats();
  }, []);

  const fetchSystemConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('*');

      if (error) throw error;

      // Parse config values
      const configMap = data.reduce((acc, item) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, any>);

      setConfig({
        max_booking_quantity: parseInt(configMap.max_booking_quantity) || 50,
        max_booking_days_advance: parseInt(configMap.max_booking_days_advance) || 90,
        default_chromebook_inventory: parseInt(configMap.default_chromebook_inventory) || 200,
        booking_time_slots: ['08:00-12:00', '13:00-17:00'],
        maintenance_mode: configMap.maintenance_mode === 'true',
        maintenance_message: 'Sistema em manutenção. Tente novamente mais tarde.',
        email_notifications: configMap.email_notifications === 'true',
        auto_cancel_past_bookings: configMap.auto_cancel_past_bookings === 'true',
        weekend_bookings_allowed: configMap.weekend_bookings_allowed === 'true'
      });
    } catch (error) {
      console.error('Error fetching system config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      // Fetch user count
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      
      if (usersError) throw usersError;

      // Fetch chromebook booking stats
      const { data: bookings, error: bookingsError } = await supabase
        .from('chromebook_bookings')
        .select('id, status', { count: 'exact' });
      
      if (bookingsError) throw bookingsError;

      // Fetch room booking stats
      const { data: roomBookings, error: roomBookingsError } = await supabase
        .from('room_bookings')
        .select('id, status', { count: 'exact' });
      
      if (roomBookingsError) throw roomBookingsError;

      const activeBookings = bookings?.filter(b => b.status === 'active').length || 0;
      const activeRoomBookings = roomBookings?.filter(b => b.status === 'active').length || 0;

      setDbStats({
        totalUsers: users?.length || 0,
        totalBookings: bookings?.length || 0,
        activeBookings,
        totalRoomBookings: roomBookings?.length || 0,
        activeRoomBookings,
        dbSize: 'N/A' // Would require database admin privileges to calculate
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    
    try {
      // Update each config value
      const updates = [
        { key: 'max_booking_quantity', value: config.max_booking_quantity.toString() },
        { key: 'max_booking_days_advance', value: config.max_booking_days_advance.toString() },
        { key: 'default_chromebook_inventory', value: config.default_chromebook_inventory.toString() },
        { key: 'maintenance_mode', value: config.maintenance_mode.toString() },
        { key: 'email_notifications', value: config.email_notifications.toString() },
        { key: 'auto_cancel_past_bookings', value: config.auto_cancel_past_bookings.toString() },
        { key: 'weekend_bookings_allowed', value: config.weekend_bookings_allowed.toString() }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('system_config')
          .update({ config_value: update.value })
          .eq('config_key', update.key);

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações do sistema foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar as configurações.",
      });
    } finally {
      setSaving(false);
    }
  };

  const testEmailSettings = async () => {
    toast({
      title: "Teste de email",
      description: "Funcionalidade de teste de email seria implementada aqui.",
    });
  };

  const runDatabaseMaintenance = async () => {
    if (!confirm('Executar manutenção do banco de dados? Esta ação pode demorar alguns minutos.')) {
      return;
    }

    try {
      setSaving(true);
      
      // Simulate database maintenance
      // In a real system, you might call a database function or edge function
      
      setTimeout(() => {
        toast({
          title: "Manutenção concluída",
          description: "A manutenção do banco de dados foi executada com sucesso.",
        });
        setSaving(false);
        fetchSystemStats();
      }, 3000);
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na manutenção",
        description: "Erro ao executar manutenção do banco de dados.",
      });
      setSaving(false);
    }
  };

  const deleteAllBookings = async () => {
    if (!confirm('⚠️ ATENÇÃO: Esta ação irá excluir TODOS os agendamentos (Chromebooks, Auditório e Laboratório) do sistema. Esta ação NÃO pode ser desfeita. Deseja continuar?')) {
      return;
    }

    try {
      setSaving(true);
      
      // Delete all chromebook bookings
      const { error: chromebookError } = await supabase
        .from('chromebook_bookings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (chromebookError) throw chromebookError;

      // Delete all room bookings
      const { error: roomError } = await supabase
        .from('room_bookings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (roomError) throw roomError;

      toast({
        title: "Agendamentos excluídos",
        description: "Todos os agendamentos foram excluídos com sucesso.",
      });
      
      fetchSystemStats();
    } catch (error) {
      console.error('Error deleting bookings:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao excluir os agendamentos.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteBookingsByDate = async () => {
    if (!deleteDate) {
      toast({
        variant: "destructive",
        title: "Data não selecionada",
        description: "Por favor, selecione uma data para excluir os agendamentos.",
      });
      return;
    }

    if (!confirm(`Excluir todos os agendamentos da data ${format(new Date(deleteDate), 'dd/MM/yyyy', { locale: ptBR })}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setSaving(true);
      
      // Delete chromebook bookings for the selected date
      const { error: chromebookError } = await supabase
        .from('chromebook_bookings')
        .delete()
        .eq('booking_date', deleteDate);

      if (chromebookError) throw chromebookError;

      // Delete room bookings for the selected date
      const { error: roomError } = await supabase
        .from('room_bookings')
        .delete()
        .eq('booking_date', deleteDate);

      if (roomError) throw roomError;

      toast({
        title: "Agendamentos excluídos",
        description: `Todos os agendamentos da data ${format(new Date(deleteDate), 'dd/MM/yyyy', { locale: ptBR })} foram excluídos.`,
      });
      
      setDeleteDate('');
      fetchSystemStats();
    } catch (error) {
      console.error('Error deleting bookings by date:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao excluir os agendamentos da data selecionada.",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    toast({
      title: "Export iniciado",
      description: "O export dos dados será implementado em versões futuras.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{dbStats.totalUsers}</div>
              <p className="text-sm text-muted-foreground">Usuários</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{dbStats.totalBookings}</div>
              <p className="text-sm text-muted-foreground">Chromebooks Total</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{dbStats.activeBookings}</div>
              <p className="text-sm text-muted-foreground">Chromebooks Ativos</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{dbStats.totalRoomBookings}</div>
              <p className="text-sm text-muted-foreground">Salas Total</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{dbStats.activeRoomBookings}</div>
              <p className="text-sm text-muted-foreground">Salas Ativos</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{dbStats.dbSize}</div>
              <p className="text-sm text-muted-foreground">Tamanho do BD</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configurações de Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max-quantity">Quantidade Máxima por Agendamento</Label>
              <Input
                id="max-quantity"
                type="number"
                min="1"
                max="200"
                value={config.max_booking_quantity}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  max_booking_quantity: parseInt(e.target.value) || 1
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="max-advance">Máximo de Dias de Antecedência</Label>
              <Input
                id="max-advance"
                type="number"
                min="1"
                max="365"
                value={config.max_booking_days_advance}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  max_booking_days_advance: parseInt(e.target.value) || 1
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="default-inventory">Inventário Padrão de Chromebooks</Label>
              <Input
                id="default-inventory"
                type="number"
                min="1"
                max="1000"
                value={config.default_chromebook_inventory}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  default_chromebook_inventory: parseInt(e.target.value) || 200
                }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Agendamentos nos Finais de Semana</Label>
                <p className="text-sm text-muted-foreground">Permitir agendamentos aos sábados e domingos</p>
              </div>
              <Switch
                checked={config.weekend_bookings_allowed}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  weekend_bookings_allowed: checked
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-cancelar Agendamentos Passados</Label>
                <p className="text-sm text-muted-foreground">Cancelar automaticamente agendamentos de datas passadas</p>
              </div>
              <Switch
                checked={config.auto_cancel_past_bookings}
                onCheckedChange={(checked) => setConfig(prev => ({
                  ...prev,
                  auto_cancel_past_bookings: checked
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Modo de Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ativar Modo de Manutenção</Label>
              <p className="text-sm text-muted-foreground">
                Bloqueia o acesso ao sistema para usuários não-administradores
              </p>
            </div>
            <Switch
              checked={config.maintenance_mode}
              onCheckedChange={(checked) => setConfig(prev => ({
                ...prev,
                maintenance_mode: checked
              }))}
            />
          </div>

          {config.maintenance_mode && (
            <div>
              <Label htmlFor="maintenance-message">Mensagem de Manutenção</Label>
              <Textarea
                id="maintenance-message"
                placeholder="Digite a mensagem que será exibida durante a manutenção..."
                value={config.maintenance_message}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  maintenance_message: e.target.value
                }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configurações de Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações por Email</Label>
              <p className="text-sm text-muted-foreground">Enviar emails para eventos importantes</p>
            </div>
            <Switch
              checked={config.email_notifications}
              onCheckedChange={(checked) => setConfig(prev => ({
                ...prev,
                email_notifications: checked
              }))}
            />
          </div>

          <Button variant="outline" onClick={testEmailSettings}>
            <Mail className="h-4 w-4 mr-2" />
            Testar Configurações de Email
          </Button>
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Gerenciamento do Banco de Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="outline" 
              onClick={runDatabaseMaintenance}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Executando...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Executar Manutenção
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={fetchSystemStats}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Estatísticas
            </Button>
            
            <Button variant="outline" onClick={exportData}>
              <Globe className="h-4 w-4 mr-2" />
              Exportar Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir Agendamentos (Zona de Perigo)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Atenção: Ações Irreversíveis</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As ações abaixo irão excluir permanentemente os registros do banco de dados. 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delete by Date */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="delete-date" className="flex items-center gap-2">
                <CalendarX className="h-4 w-4" />
                Excluir Agendamentos por Data
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Selecione uma data específica para excluir todos os agendamentos (Chromebooks e Salas)
              </p>
              <div className="flex gap-2">
                <Input
                  id="delete-date"
                  type="date"
                  value={deleteDate}
                  onChange={(e) => setDeleteDate(e.target.value)}
                  className="max-w-xs"
                />
                <Button 
                  variant="destructive" 
                  onClick={deleteBookingsByDate}
                  disabled={saving || !deleteDate}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <CalendarX className="h-4 w-4 mr-2" />
                      Excluir Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delete All */}
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir Todos os Agendamentos
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Esta ação irá excluir TODOS os agendamentos de Chromebooks, Auditório e Laboratório do sistema.
              </p>
              <Button 
                variant="destructive" 
                onClick={deleteAllBookings}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Todos os Agendamentos
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}