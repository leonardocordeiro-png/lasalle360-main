import { useState, useEffect } from 'react';
import CalendarBlocksManager from './CalendarBlocksManager';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Database,
  Plus,
  Edit,
  Calendar,
  Chrome,
  AlertCircle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InventoryItem {
  id: string;
  date: string;
  total_available: number;
  created_at: string;
  updated_at: string;
}

interface BookingSummary {
  date: string;
  total_booked: number;
  booking_count: number;
}

export default function InventoryManagement() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bookingSummary, setBookingSummary] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newQuantity, setNewQuantity] = useState('200');
  const [saving, setSaving] = useState(false);
  const [showGenerateWeekDialog, setShowGenerateWeekDialog] = useState(false);
  const [weekQuantity, setWeekQuantity] = useState('200');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchInventory(), fetchBookingSummary()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('chromebook_inventory')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    setInventory(data || []);
  };

  const fetchBookingSummary = async () => {
    const { data, error } = await supabase
      .from('chromebook_bookings')
      .select('booking_date, quantity, status')
      .eq('status', 'active');

    if (error) throw error;

    // Group bookings by date
    const summary = data.reduce((acc, booking) => {
      const date = booking.booking_date;
      if (!acc[date]) {
        acc[date] = {
          date,
          total_booked: 0,
          booking_count: 0
        };
      }
      acc[date].total_booked += booking.quantity;
      acc[date].booking_count += 1;
      return acc;
    }, {} as Record<string, BookingSummary>);

    setBookingSummary(Object.values(summary));
  };

  const addInventoryItem = async () => {
    if (!newDate || !newQuantity) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, preencha todos os campos",
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('chromebook_inventory')
        .upsert({
          date: newDate,
          total_available: parseInt(newQuantity)
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Inventário atualizado com sucesso",
      });

      setShowAddDialog(false);
      setNewDate('');
      setNewQuantity('200');
      await fetchInventory();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao atualizar inventário",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateInventoryItem = async () => {
    if (!selectedItem || !newQuantity) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('chromebook_inventory')
        .update({ total_available: parseInt(newQuantity) })
        .eq('id', selectedItem.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Inventário atualizado com sucesso",
      });

      setShowEditDialog(false);
      setSelectedItem(null);
      setNewQuantity('200');
      await fetchInventory();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao atualizar inventário",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteInventoryItem = async (item: InventoryItem) => {
    if (!confirm('Tem certeza que deseja remover este item do inventário?')) return;

    try {
      const { error } = await supabase
        .from('chromebook_inventory')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Item removido do inventário",
      });

      await fetchInventory();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao remover item do inventário",
      });
    }
  };

  const generateWeekInventory = async () => {
    if (!weekQuantity || parseInt(weekQuantity) <= 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, informe uma quantidade válida de Chromebooks",
      });
      return;
    }

    const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekDates = Array.from({ length: 5 }, (_, i) =>
      format(addDays(startDate, i), 'yyyy-MM-dd')
    );

    try {
      setSaving(true);

      const inventoryItems = weekDates.map(date => ({
        date,
        total_available: parseInt(weekQuantity)
      }));

      const { error } = await supabase
        .from('chromebook_inventory')
        .upsert(inventoryItems);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Inventário da semana gerado com ${weekQuantity} Chromebooks por dia`,
      });

      setShowGenerateWeekDialog(false);
      setWeekQuantity('200');
      await fetchInventory();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao gerar inventário da semana",
      });
    } finally {
      setSaving(false);
    }
  };

  const getAvailabilityStatus = (date: string, totalAvailable: number) => {
    const booking = bookingSummary.find(b => b.date === date);
    if (!booking) return { available: totalAvailable, status: 'available' };

    const available = totalAvailable - booking.total_booked;
    const percentage = (available / totalAvailable) * 100;

    if (percentage <= 10) return { available, status: 'critical' };
    if (percentage <= 30) return { available, status: 'warning' };
    return { available, status: 'available' };
  };

  const getStatusBadge = (status: string, available: number) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive">{available} disponíveis</Badge>;
      case 'warning':
        return <Badge className="bg-warning text-warning-foreground">{available} disponíveis</Badge>;
      default:
        return <Badge className="bg-success text-success-foreground">{available} disponíveis</Badge>;
    }
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
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Gerenciamento de Inventário
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setShowGenerateWeekDialog(true)}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Gerar Semana
              </Button>
              <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Data
              </Button>
              <Button variant="outline" onClick={fetchData} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Total Disponível</TableHead>
                  <TableHead>Em Uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agendamentos</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => {
                  const { available, status } = getAvailabilityStatus(item.date, item.total_available);
                  const booking = bookingSummary.find(b => b.date === item.date);

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(item.date), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Chrome className="h-4 w-4 text-muted-foreground" />
                          <span className="font-bold">{item.total_available}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {booking?.total_booked || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(status, available)}
                      </TableCell>
                      <TableCell>
                        {booking ? (
                          <Badge variant="outline">
                            {booking.booking_count} agendamentos
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(item.updated_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setNewQuantity(item.total_available.toString());
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteInventoryItem(item)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {inventory.length === 0 && (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum inventário configurado</h3>
              <p className="text-muted-foreground mb-4">
                Configure o inventário de chromebooks para diferentes datas.
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Inventory Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Inventário</DialogTitle>
            <DialogDescription>
              Configure a quantidade de chromebooks disponíveis para uma data específica.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantidade Disponível</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                max="500"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={addInventoryItem} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Inventory Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Inventário</DialogTitle>
            <DialogDescription>
              Altere a quantidade de chromebooks disponíveis para {selectedItem?.date && format(new Date(selectedItem.date), 'dd/MM/yyyy', { locale: ptBR })}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-quantity">Quantidade Disponível</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                max="500"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={updateInventoryItem} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Salvando...' : 'Atualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Week Inventory Dialog */}
      <Dialog open={showGenerateWeekDialog} onOpenChange={setShowGenerateWeekDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Chrome className="h-5 w-5" />
              Gerar Inventário da Semana
            </DialogTitle>
            <DialogDescription>
              Defina a quantidade de Chromebooks disponíveis para cada dia útil desta semana (segunda a sexta).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium text-sm">Atenção</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Este valor será usado como base para calcular a disponibilidade no Dashboard.
                Certifique-se de informar a quantidade real de Chromebooks funcionais.
              </p>
            </div>
            <div>
              <Label htmlFor="week-quantity" className="text-base">
                Quantidade de Chromebooks Disponíveis
              </Label>
              <Input
                id="week-quantity"
                type="number"
                min="1"
                max="500"
                value={weekQuantity}
                onChange={(e) => setWeekQuantity(e.target.value)}
                className="mt-2 text-lg font-medium"
                placeholder="Ex: 200"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valor será aplicado para todos os dias da semana atual
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowGenerateWeekDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={generateWeekInventory} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Gerando...' : 'Gerar Semana'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendar Blocks Manager */}
      <CalendarBlocksManager />
    </div>
  );
}