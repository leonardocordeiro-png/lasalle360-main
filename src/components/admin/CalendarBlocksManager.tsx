import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Lock,
    Plus,
    Edit,
    Calendar,
    Trash2,
    RefreshCw,
    User,
    Wrench,
    CalendarClock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarBlock {
    id: string;
    resource_type: 'chromebook' | 'auditorio' | 'laboratorio' | 'sala_criativa';
    block_date: string;
    start_time: string;
    end_time: string;
    reason: 'manutencao' | 'atividade' | 'reserva_pessoal';
    description: string | null;
    reserved_for: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

const RESOURCE_TYPES = [
    { value: 'chromebook', label: 'Chromebooks' },
    { value: 'auditorio', label: 'Auditório' },
    { value: 'laboratorio', label: 'Laboratório de Informática' },
    { value: 'sala_criativa', label: 'Sala Criativa' }
];

const REASON_TYPES = [
    { value: 'manutencao', label: 'Manutenção', icon: Wrench },
    { value: 'atividade', label: 'Atividade Especial', icon: CalendarClock },
    { value: 'reserva_pessoal', label: 'Reserva para Pessoa', icon: User }
];

export default function CalendarBlocksManager() {
    const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [resourceType, setResourceType] = useState<string>('chromebook');
    const [blockDate, setBlockDate] = useState('');
    const [startTime, setStartTime] = useState('07:00');
    const [endTime, setEndTime] = useState('17:30');
    const [reason, setReason] = useState<string>('manutencao');
    const [description, setDescription] = useState('');
    const [reservedFor, setReservedFor] = useState('');

    useEffect(() => {
        fetchBlocks();
    }, []);

    const fetchBlocks = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('calendar_blocks')
                .select('*')
                .gte('block_date', format(new Date(), 'yyyy-MM-dd'))
                .order('block_date', { ascending: true })
                .order('start_time', { ascending: true });

            if (error) throw error;
            setBlocks((data || []) as CalendarBlock[]);
        } catch (error: any) {
            console.error('Error fetching blocks:', error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Erro ao carregar bloqueios",
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setResourceType('chromebook');
        setBlockDate('');
        setStartTime('07:00');
        setEndTime('17:30');
        setReason('manutencao');
        setDescription('');
        setReservedFor('');
        setSelectedBlock(null);
    };

    const openAddDialog = () => {
        resetForm();
        setShowAddDialog(true);
    };

    const openEditDialog = (block: CalendarBlock) => {
        setSelectedBlock(block);
        setResourceType(block.resource_type);
        setBlockDate(block.block_date);
        setStartTime(block.start_time.slice(0, 5));
        setEndTime(block.end_time.slice(0, 5));
        setReason(block.reason);
        setDescription(block.description || '');
        setReservedFor(block.reserved_for || '');
        setShowEditDialog(true);
    };

    const validateForm = () => {
        if (!blockDate) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Selecione uma data",
            });
            return false;
        }
        if (!startTime || !endTime) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Preencha os horários de início e fim",
            });
            return false;
        }
        if (startTime >= endTime) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "O horário de fim deve ser posterior ao horário de início",
            });
            return false;
        }
        if (reason === 'reserva_pessoal' && !reservedFor.trim()) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Informe o nome da pessoa para reserva pessoal",
            });
            return false;
        }
        return true;
    };

    const addBlock = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('calendar_blocks')
                .insert({
                    resource_type: resourceType,
                    block_date: blockDate,
                    start_time: startTime,
                    end_time: endTime,
                    reason: reason,
                    description: description || null,
                    reserved_for: reason === 'reserva_pessoal' ? reservedFor : null,
                    created_by: user?.id
                });

            if (error) throw error;

            toast({
                title: "Sucesso",
                description: "Bloqueio criado com sucesso",
            });

            setShowAddDialog(false);
            resetForm();
            await fetchBlocks();
        } catch (error: any) {
            console.error('Error adding block:', error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: error.message || "Erro ao criar bloqueio",
            });
        } finally {
            setSaving(false);
        }
    };

    const updateBlock = async () => {
        if (!selectedBlock || !validateForm()) return;

        try {
            setSaving(true);

            const { error } = await supabase
                .from('calendar_blocks')
                .update({
                    resource_type: resourceType,
                    block_date: blockDate,
                    start_time: startTime,
                    end_time: endTime,
                    reason: reason,
                    description: description || null,
                    reserved_for: reason === 'reserva_pessoal' ? reservedFor : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedBlock.id);

            if (error) throw error;

            toast({
                title: "Sucesso",
                description: "Bloqueio atualizado com sucesso",
            });

            setShowEditDialog(false);
            resetForm();
            await fetchBlocks();
        } catch (error: any) {
            console.error('Error updating block:', error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: error.message || "Erro ao atualizar bloqueio",
            });
        } finally {
            setSaving(false);
        }
    };

    const deleteBlock = async (block: CalendarBlock) => {
        if (!confirm('Tem certeza que deseja remover este bloqueio?')) return;

        try {
            const { error } = await supabase
                .from('calendar_blocks')
                .delete()
                .eq('id', block.id);

            if (error) throw error;

            toast({
                title: "Sucesso",
                description: "Bloqueio removido com sucesso",
            });

            await fetchBlocks();
        } catch (error: any) {
            console.error('Error deleting block:', error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Erro ao remover bloqueio",
            });
        }
    };

    const getResourceLabel = (type: string) => {
        return RESOURCE_TYPES.find(r => r.value === type)?.label || type;
    };

    const getReasonLabel = (reasonValue: string) => {
        return REASON_TYPES.find(r => r.value === reasonValue)?.label || reasonValue;
    };

    const getReasonBadge = (reasonValue: string) => {
        switch (reasonValue) {
            case 'manutencao':
                return <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"><Wrench className="h-3 w-3 mr-1" />{getReasonLabel(reasonValue)}</Badge>;
            case 'atividade':
                return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><CalendarClock className="h-3 w-3 mr-1" />{getReasonLabel(reasonValue)}</Badge>;
            case 'reserva_pessoal':
                return <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"><User className="h-3 w-3 mr-1" />{getReasonLabel(reasonValue)}</Badge>;
            default:
                return <Badge variant="outline">{getReasonLabel(reasonValue)}</Badge>;
        }
    };

    const formFields = (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="resource-type">Recurso</Label>
                    <Select value={resourceType} onValueChange={setResourceType}>
                        <SelectTrigger id="resource-type">
                            <SelectValue placeholder="Selecione o recurso" />
                        </SelectTrigger>
                        <SelectContent>
                            {RESOURCE_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="block-date">Data</Label>
                    <Input
                        id="block-date"
                        type="date"
                        value={blockDate}
                        onChange={(e) => setBlockDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start-time">Horário Início</Label>
                    <Input
                        id="start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end-time">Horário Fim</Label>
                    <Input
                        id="end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="reason">Motivo do Bloqueio</Label>
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="reason">
                        <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                        {REASON_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                    <type.icon className="h-4 w-4" />
                                    {type.label}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {reason === 'reserva_pessoal' && (
                <div className="space-y-2">
                    <Label htmlFor="reserved-for">Reservado para</Label>
                    <Input
                        id="reserved-for"
                        type="text"
                        placeholder="Nome da pessoa"
                        value={reservedFor}
                        onChange={(e) => setReservedFor(e.target.value)}
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                    id="description"
                    placeholder="Detalhes adicionais sobre o bloqueio..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                />
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Bloqueio de Calendário
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
                        <Button onClick={openAddDialog} className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Bloqueio
                        </Button>
                        <Button variant="outline" onClick={fetchBlocks} className="w-full sm:w-auto">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Atualizar
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {blocks.length === 0 ? (
                    <div className="text-center py-12">
                        <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Nenhum bloqueio ativo</h3>
                        <p className="text-muted-foreground mb-4">
                            Crie bloqueios para reservar datas e horários no calendário.
                        </p>
                        <Button onClick={openAddDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Criar Primeiro Bloqueio
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Recurso</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Horário</TableHead>
                                    <TableHead>Motivo</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {blocks.map((block) => (
                                    <TableRow key={block.id}>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {getResourceLabel(block.resource_type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">
                                                    {format(new Date(block.block_date), 'dd/MM/yyyy', { locale: ptBR })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {block.start_time.slice(0, 5)} - {block.end_time.slice(0, 5)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {getReasonBadge(block.reason)}
                                            {block.reserved_for && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Para: {block.reserved_for}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                                                {block.description || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditDialog(block)}
                                                >
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => deleteBlock(block)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            {/* Add Block Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5" />
                            Novo Bloqueio de Calendário
                        </DialogTitle>
                        <DialogDescription>
                            Bloqueie uma data/horário para impedir agendamentos no período selecionado.
                        </DialogDescription>
                    </DialogHeader>
                    {formFields}
                    <DialogFooter className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowAddDialog(false)} className="w-full sm:w-auto">
                            Cancelar
                        </Button>
                        <Button onClick={addBlock} disabled={saving} className="w-full sm:w-auto">
                            {saving ? 'Salvando...' : 'Criar Bloqueio'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Block Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Editar Bloqueio
                        </DialogTitle>
                        <DialogDescription>
                            Altere as informações do bloqueio de calendário.
                        </DialogDescription>
                    </DialogHeader>
                    {formFields}
                    <DialogFooter className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowEditDialog(false)} className="w-full sm:w-auto">
                            Cancelar
                        </Button>
                        <Button onClick={updateBlock} disabled={saving} className="w-full sm:w-auto">
                            {saving ? 'Salvando...' : 'Atualizar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
