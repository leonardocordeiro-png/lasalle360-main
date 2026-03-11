import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Clock, User, MoreVertical, Trash2, X, ArrowRightLeft, Chrome, Lock, RotateCcw, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ChromebookBooking {
  id: string;
  class_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
  quantity: number;
  full_name: string;
}

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

interface ChromebookTimeSlotCardProps {
  timeSlot: TimeSlot;
  bookings: ChromebookBooking[];
  availableCount: number;
  totalInventory: number;
  isSelected: boolean;
  isPast: boolean;
  onSelect: () => void;
  onBookingCancelled: () => void;
  onTransferClick: (booking: ChromebookBooking) => void;
  isAdmin: boolean;
  currentUserId?: string;
  isBlocked?: boolean;
  blockReason?: string;
  blockDescription?: string | null;
}

export function ChromebookTimeSlotCard({
  timeSlot,
  bookings,
  availableCount,
  totalInventory,
  isSelected,
  isPast,
  onSelect,
  onBookingCancelled,
  onTransferClick,
  isAdmin,
  currentUserId,
  isBlocked = false,
  blockReason,
  blockDescription,
}: ChromebookTimeSlotCardProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ChromebookBooking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editQuantity, setEditQuantity] = useState(1);

  const hasBookings = bookings.length > 0;
  const isFull = availableCount === 0;
  // Com lógica cumulativa, mostrar amarelo se disponibilidade < total (mesmo sem bookings neste slot específico)
  const isPartial = availableCount > 0 && availableCount < totalInventory;
  const isAvailable = availableCount > 0;

  const getStatusColor = () => {
    if (isBlocked) return "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed";
    if (isSelected) return "border-blue-400 dark:border-blue-500 bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-500/20";
    if (isFull) return "border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/30";
    if (isPartial) return "border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-700";
    return "border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md";
  };

  const getAccentBar = () => {
    if (isBlocked) return "bg-gray-400";
    if (isSelected) return "bg-blue-500";
    if (isFull) return "bg-red-500";
    if (isPartial) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getBlockReasonLabel = () => {
    switch (blockReason) {
      case 'manutencao': return 'Manutenção';
      case 'atividade': return 'Atividade Especial';
      case 'reserva_pessoal': return 'Reservado';
      default: return 'Bloqueado';
    }
  };

  const getStatusBadge = () => {
    if (isBlocked) {
      return <Badge variant="secondary" className="text-[10px] bg-gray-500 hover:bg-gray-600 text-white whitespace-nowrap px-1.5 py-0 h-5"><Lock className="h-2.5 w-2.5 mr-1" />{getBlockReasonLabel()}</Badge>;
    }
    if (isFull) {
      return <Badge variant="destructive" className="text-[10px] whitespace-nowrap px-1.5 py-0 h-5">Lotado</Badge>;
    }
    if (isPartial) {
      return <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600 whitespace-nowrap px-1.5 py-0 h-5">{availableCount} disponíveis</Badge>;
    }
    return <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600 whitespace-nowrap px-1.5 py-0 h-5">{availableCount} disponíveis</Badge>;
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({ status: 'cancelled' })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "O agendamento foi cancelado com sucesso.",
      });

      onBookingCancelled();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao cancelar agendamento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setCancelDialogOpen(false);
      setSelectedBooking(null);
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    setIsLoading(true);

    try {
      // Buscar TODOS os agendamentos do mesmo usuário, mesma data e mesma turma
      // para devolver todos os horários juntos
      const { data: relatedBookings, error: fetchError } = await supabase
        .from('chromebook_bookings')
        .select('id')
        .eq('user_id', selectedBooking.user_id)
        .eq('booking_date', selectedBooking.booking_date)
        .eq('class_name', selectedBooking.class_name)
        .eq('status', 'active');

      if (fetchError) throw fetchError;

      const bookingIds = relatedBookings?.map(b => b.id) || [selectedBooking.id];

      const { error } = await supabase
        .from('chromebook_bookings')
        .delete()
        .in('id', bookingIds);

      if (error) throw error;

      const deleteCount = bookingIds.length;
      toast({
        title: "Devolução realizada!",
        description: deleteCount > 1 
          ? `${deleteCount} horários foram devolvidos com sucesso.`
          : "O agendamento foi devolvido com sucesso.",
      });

      onBookingCancelled();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao devolver agendamento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
      setSelectedBooking(null);
    }
  };

  const handleUpdateQuantity = async () => {
    if (!selectedBooking) return;
    setIsLoading(true);

    try {
      // Buscar TODOS os agendamentos do mesmo usuário, mesma data e mesma turma
      // para sincronizar a quantidade em todos os horários
      const { data: relatedBookings, error: fetchError } = await supabase
        .from('chromebook_bookings')
        .select('id, quantity, start_time, end_time')
        .eq('user_id', selectedBooking.user_id)
        .eq('booking_date', selectedBooking.booking_date)
        .eq('class_name', selectedBooking.class_name)
        .eq('status', 'active');

      if (fetchError) throw fetchError;

      const bookingIds = relatedBookings?.map(b => b.id) || [selectedBooking.id];
      const updateCount = bookingIds.length;

      // Atualizar TODOS os agendamentos encontrados com a nova quantidade
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({ quantity: editQuantity })
        .in('id', bookingIds);

      if (error) throw error;

      toast({
        title: "Agendamentos sincronizados!",
        description: updateCount > 1 
          ? `Quantidade alterada para ${editQuantity} Chromebook(s) em ${updateCount} horários.`
          : `Quantidade alterada para ${editQuantity} Chromebook(s).`,
      });

      onBookingCancelled();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar agendamentos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setEditDialogOpen(false);
      setSelectedBooking(null);
    }
  };

  const canManageBooking = (booking: ChromebookBooking) => {
    return isAdmin || booking.user_id === currentUserId;
  };

  const openEditDialog = (booking: ChromebookBooking) => {
    setSelectedBooking(booking);
    setEditQuantity(booking.quantity);
    setEditDialogOpen(true);
  };

  return (
    <>
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer border min-w-0 group/card",
          getStatusColor(),
          (isPast || isBlocked) && "opacity-60 cursor-not-allowed",
        )}
        onClick={() => !isPast && !isBlocked && isAvailable && onSelect()}
      >
        {/* Left Accent Bar */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l transition-all duration-300", getAccentBar())} />

        <div className="pl-3.5 pr-3 py-3 space-y-2 min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center h-6 w-6 rounded-md transition-colors duration-200 flex-shrink-0",
                isSelected ? "bg-blue-500/15" : isBlocked ? "bg-gray-200 dark:bg-gray-800" : "bg-muted/60"
              )}>
                <Clock className={cn(
                  "h-3.5 w-3.5 transition-colors duration-200",
                  isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                )} />
              </div>
              <span className="font-semibold text-sm whitespace-nowrap tracking-tight">{timeSlot.label}</span>
            </div>
            {getStatusBadge()}
          </div>

          {/* Bookings List */}
          {hasBookings && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-border/20 scrollbar-track-transparent">
                {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between text-xs bg-background/60 backdrop-blur-sm rounded-lg p-2 transition-colors duration-150 hover:bg-background/80"
                  onClick={(e) => e.stopPropagation()}
                  title={`${booking.full_name} - ${booking.class_name} - ${booking.quantity} Chromebook(s) - ${booking.start_time} às ${booking.end_time}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-2.5 w-2.5 text-primary" />
                    </div>
                    <div className="truncate">
                      <span className="font-medium text-[11px]">
                        {(() => {
                          const parts = booking.full_name?.split(' ') || [];
                          if (parts.length <= 2) return booking.full_name;
                          return `${parts[0]} ${parts[parts.length - 1]}`;
                        })()}
                      </span>
                      <span className="text-muted-foreground ml-1 text-[10px]">({booking.class_name})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-md border-primary/20">
                      <Chrome className="h-2.5 w-2.5 mr-0.5" />
                      {booking.quantity}
                    </Badge>
                    {canManageBooking(booking) && !isPast && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 rounded-md hover:bg-muted">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(booking)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedBooking(booking);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onTransferClick(booking)}
                                className="text-blue-600"
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Transferir Solicitante
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-green-600"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Devolver
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Blocked State */}
          {isBlocked && (
            <div className="text-xs text-center py-2">
              <div className="flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-400">
                <Lock className="h-3 w-3" />
                <span className="font-medium">Horário Bloqueado</span>
              </div>
              {blockDescription && (
                <p className="text-muted-foreground mt-1 truncate text-[10px]">{blockDescription}</p>
              )}
            </div>
          )}

          {/* Empty State */}
          {!hasBookings && !isBlocked && isAvailable && (
            <p className="text-[11px] text-muted-foreground text-center py-1.5 group-hover/card:text-foreground/60 transition-colors duration-200">
              Clique para selecionar
            </p>
          )}
        </div>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento?
              <br /><br />
              <strong>Solicitante:</strong> {selectedBooking?.full_name}<br />
              <strong>Turma:</strong> {selectedBooking?.class_name}<br />
              <strong>Quantidade:</strong> {selectedBooking?.quantity} Chromebooks
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Cancelando..." : "Cancelar Agendamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver Chromebooks</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a devolução dos Chromebooks deste agendamento?
              <br /><br />
              <strong>Solicitante:</strong> {selectedBooking?.full_name}<br />
              <strong>Turma:</strong> {selectedBooking?.class_name}<br />
              <strong>Quantidade:</strong> {selectedBooking?.quantity} Chromebooks
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBooking}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Devolvendo..." : "Confirmar Devolução"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere a quantidade de Chromebooks para este agendamento.
              <br /><br />
              <strong>Atenção:</strong> Esta alteração será aplicada a todos os horários agendados pelo mesmo usuário ({selectedBooking?.full_name}) na mesma data e turma.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade de Chromebooks</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={totalInventory}
                value={editQuantity}
                onChange={(e) => setEditQuantity(Math.max(1, Math.min(totalInventory, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Disponível: {availableCount} Chromebook(s)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateQuantity} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}