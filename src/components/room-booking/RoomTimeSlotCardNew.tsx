import { memo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock, User, Pencil, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoomBookingEditDialog } from "./RoomBookingEditDialog";

interface ConsecutiveBooking {
  id: string;
  start_time: string;
  end_time: string;
}

interface RoomBooking {
  id: string;
  class_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
  full_name: string;
  observations?: string;
  room_type?: string;
}

interface RoomTimeSlotCardNewProps {
  timeSlot: { start: string; end: string; label: string };
  booking: RoomBooking | null;
  isSelected: boolean;
  isPast: boolean;
  onSelect: () => void;
  onBookingCancelled?: () => void;
  isAdmin?: boolean;
  currentUserId?: string;
  roomType?: string;
}

const RoomTimeSlotCardNew = memo(({
  timeSlot,
  booking,
  isSelected,
  isPast,
  onSelect,
  onBookingCancelled,
  isAdmin = false,
  currentUserId,
  roomType,
}: RoomTimeSlotCardNewProps) => {
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [consecutiveBookings, setConsecutiveBookings] = useState<ConsecutiveBooking[]>([]);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupAction, setGroupAction] = useState<'cancel' | 'delete' | null>(null);
  const [applyToAll, setApplyToAll] = useState<'all' | 'single'>('single');
  const [isLoadingConsecutive, setIsLoadingConsecutive] = useState(false);

  const isOwner = booking && booking.user_id === currentUserId;
  const canCancelBooking = booking && (isAdmin || isOwner);
  const canEditBooking = booking && isAdmin;
  const canDeleteBooking = booking && isAdmin;
  const isBooked = !!booking;
  const isAvailable = !isBooked && !isPast;

  // Calcular duração
  const calculateDuration = () => {
    const [startH, startM] = timeSlot.start.split(':').map(Number);
    const [endH, endM] = timeSlot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes - startMinutes;
  };

  const duration = calculateDuration();

  // Buscar agendamentos consecutivos do mesmo usuário/sala/data
  const findConsecutiveBookings = async (): Promise<ConsecutiveBooking[]> => {
    if (!booking) return [];
    
    setIsLoadingConsecutive(true);
    try {
      const { data, error } = await supabase
        .from('room_bookings')
        .select('id, start_time, end_time')
        .eq('booking_date', booking.booking_date)
        .eq('room_type', roomType || 'auditorio')
        .eq('user_id', booking.user_id)
        .eq('class_name', booking.class_name)
        .eq('status', 'active')
        .order('start_time');

      if (error) throw error;
      
      if (!data || data.length <= 1) return [];
      
      // Encontrar grupo consecutivo que inclui o booking atual
      const sorted = data.sort((a, b) => a.start_time.localeCompare(b.start_time));
      const groups: ConsecutiveBooking[][] = [];
      let currentGroup: ConsecutiveBooking[] = [sorted[0]];
      
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start_time === currentGroup[currentGroup.length - 1].end_time) {
          currentGroup.push(sorted[i]);
        } else {
          if (currentGroup.length > 1) groups.push(currentGroup);
          currentGroup = [sorted[i]];
        }
      }
      if (currentGroup.length > 1) groups.push(currentGroup);
      
      // Encontrar o grupo que contém o booking atual
      for (const group of groups) {
        if (group.some(b => b.id === booking.id)) {
          return group;
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error finding consecutive bookings:', error);
      return [];
    } finally {
      setIsLoadingConsecutive(false);
    }
  };

  const handleActionClick = async (action: 'cancel' | 'delete') => {
    const consecutive = await findConsecutiveBookings();
    setConsecutiveBookings(consecutive);
    setGroupAction(action);
    setApplyToAll('single');
    
    if (consecutive.length > 1) {
      // Mostrar dialog de escolha
      setShowGroupDialog(true);
    } else {
      // Apenas um agendamento, ir direto para confirmação
      if (action === 'cancel') {
        setShowCancelDialog(true);
      } else {
        setShowDeleteDialog(true);
      }
    }
  };

  const handleGroupActionConfirm = () => {
    setShowGroupDialog(false);
    if (groupAction === 'cancel') {
      setShowCancelDialog(true);
    } else if (groupAction === 'delete') {
      setShowDeleteDialog(true);
    }
  };

  const handleClick = () => {
    if (isPast) return;
    
    // Se está reservado e o usuário é o dono ou admin, não faz nada no clique
    // As ações são feitas pelo menu dropdown
    if (isBooked) return;
    
    // Se está disponível, seleciona
    if (!isBooked) {
      onSelect();
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;

    try {
      const idsToCancel = applyToAll === 'all' && consecutiveBookings.length > 1
        ? consecutiveBookings.map(b => b.id)
        : [booking.id];

      const { error } = await supabase
        .from('room_bookings')
        .update({ status: 'cancelled' })
        .in('id', idsToCancel);

      if (error) throw error;

      const count = idsToCancel.length;
      toast({
        title: "Agendamento cancelado!",
        description: count > 1 
          ? `${count} horários foram cancelados com sucesso.`
          : "O agendamento foi cancelado com sucesso.",
      });

      setShowCancelDialog(false);
      setConsecutiveBookings([]);
      onBookingCancelled?.();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar o agendamento.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBooking = async () => {
    if (!booking) return;

    setIsDeleting(true);
    try {
      const idsToDelete = applyToAll === 'all' && consecutiveBookings.length > 1
        ? consecutiveBookings.map(b => b.id)
        : [booking.id];

      const { error } = await supabase
        .from('room_bookings')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      const count = idsToDelete.length;
      toast({
        title: "Agendamento excluído!",
        description: count > 1 
          ? `${count} horários foram excluídos permanentemente.`
          : "O agendamento foi excluído permanentemente.",
      });

      setShowDeleteDialog(false);
      setConsecutiveBookings([]);
      onBookingCancelled?.();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o agendamento.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = () => {
    if (isSelected) {
      return (
        <Badge className="bg-blue-500 text-white text-xs">
          Selecionado
        </Badge>
      );
    }
    if (isBooked) {
      return (
        <Badge variant="destructive" className="text-xs">
          Reservado
        </Badge>
      );
    }
    if (isPast) {
      return (
        <Badge variant="secondary" className="text-xs">
          Indisponível
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500 text-white text-xs">
        Livre
      </Badge>
    );
  };

  // Preparar booking com room_type para o diálogo de edição
  const bookingWithRoomType = booking ? { ...booking, room_type: roomType || booking.room_type || 'auditorio' } : null;

  return (
    <>
      <Card
        onClick={handleClick}
        className={cn(
          "relative overflow-hidden transition-all duration-200 group",
          !isBooked && !isPast && "cursor-pointer hover:shadow-md hover:border-border/60",
          isBooked && "cursor-default",
          isSelected && "ring-2 ring-blue-400 bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
          isBooked && !isSelected && "bg-red-50/30 dark:bg-red-950/10 border-red-200/50 dark:border-red-800/30",
          isAvailable && !isSelected && "bg-card/50 border-border/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10",
          isPast && "opacity-40 cursor-not-allowed bg-muted/30"
        )}
      >
        {/* Left Accent Bar */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l",
          isSelected && "bg-blue-500",
          isBooked && !isSelected && "bg-red-400",
          isAvailable && !isSelected && "bg-emerald-400",
          isPast && !isBooked && "bg-gray-300"
        )} />

        {/* Checkmark para selecionado */}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-sm">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}

        {/* Menu de ações para reservas */}
        {isBooked && !isPast && (isOwner || isAdmin) && (
          <div className="absolute top-2.5 right-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 shadow-sm rounded-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditBooking && (
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar Agendamento
                  </DropdownMenuItem>
                )}
                {canCancelBooking && (
                  <DropdownMenuItem 
                    onClick={() => handleActionClick('cancel')}
                    className="text-amber-600"
                    disabled={isLoadingConsecutive}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancelar Agendamento
                  </DropdownMenuItem>
                )}
                {canDeleteBooking && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleActionClick('delete')}
                      className="text-destructive"
                      disabled={isLoadingConsecutive}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Permanentemente
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="pl-4 pr-3.5 py-3.5 space-y-2.5">
          {/* Time + Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-bold text-sm tracking-tight">
                {timeSlot.start} - {timeSlot.end}
              </span>
            </div>
            {!isBooked && getStatusBadge()}
            {isBooked && !isOwner && !isAdmin && getStatusBadge()}
          </div>

          {/* Booking info or availability */}
          {isBooked ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate text-[13px]">
                  {(() => {
                    const parts = booking.full_name?.split(' ') || [];
                    if (parts.length <= 2) return booking.full_name;
                    return `${parts[0]} ${parts[parts.length - 1]}`;
                  })()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate pl-5">
                {booking.class_name}
              </p>
              {isOwner && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-0.5 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-md font-medium">
                  Sua reserva
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              {isPast ? "Horário passado" : "Clique para reservar"}
            </p>
          )}

          {/* Duration */}
          <p className="text-[10px] text-muted-foreground/70 font-medium">
            Duração: {duration} min
          </p>
        </div>
      </Card>

      {/* Diálogo de escolha de grupo */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {groupAction === 'cancel' ? 'Cancelar agendamento' : 'Excluir agendamento'}
            </DialogTitle>
            <DialogDescription>
              Este horário faz parte de um grupo de <strong>{consecutiveBookings.length} horários consecutivos</strong> agendados.
              <br /><br />
              Período completo: <strong>
                {consecutiveBookings.length > 0 && `${consecutiveBookings[0]?.start_time?.slice(0, 5)} - ${consecutiveBookings[consecutiveBookings.length - 1]?.end_time?.slice(0, 5)}`}
              </strong>
            </DialogDescription>
          </DialogHeader>
          
          <RadioGroup value={applyToAll} onValueChange={(v) => setApplyToAll(v as 'all' | 'single')} className="mt-4">
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="single" id="single" className="mt-0.5" />
              <Label htmlFor="single" className="cursor-pointer flex-1">
                <span className="font-medium">Apenas este horário</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {groupAction === 'cancel' ? 'Cancelar' : 'Excluir'} apenas {timeSlot.start} - {timeSlot.end}
                </p>
              </Label>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="all" id="all" className="mt-0.5" />
              <Label htmlFor="all" className="cursor-pointer flex-1">
                <span className="font-medium">Todos os {consecutiveBookings.length} horários</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {groupAction === 'cancel' ? 'Cancelar' : 'Excluir'} todo o período agendado
                </p>
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Voltar
            </Button>
            <Button 
              onClick={handleGroupActionConfirm}
              variant={groupAction === 'delete' ? 'destructive' : 'default'}
              className={groupAction === 'cancel' ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Cancelamento */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar {applyToAll === 'all' && consecutiveBookings.length > 1 
                ? `${consecutiveBookings.length} horários` 
                : 'o agendamento'} de{' '}
              <strong>{booking?.full_name}</strong>?
              <br />
              Turma: {booking?.class_name}
              <br />
              Horário: {applyToAll === 'all' && consecutiveBookings.length > 1
                ? `${consecutiveBookings[0]?.start_time?.slice(0, 5)} - ${consecutiveBookings[consecutiveBookings.length - 1]?.end_time?.slice(0, 5)}`
                : timeSlot.label}
              <br /><br />
              {applyToAll === 'all' && consecutiveBookings.length > 1 
                ? 'Os horários ficarão disponíveis para outras reservas.'
                : 'O horário ficará disponível para outras reservas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelBooking} 
              className="bg-amber-600 hover:bg-amber-700"
            >
              Sim, cancelar{applyToAll === 'all' && consecutiveBookings.length > 1 ? ` ${consecutiveBookings.length} horários` : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Exclusão (apenas admin) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-destructive font-medium">
                Esta ação não pode ser desfeita!
              </span>
              <br /><br />
              {applyToAll === 'all' && consecutiveBookings.length > 1
                ? `${consecutiveBookings.length} horários`
                : 'O agendamento'} de <strong>{booking?.full_name}</strong> {applyToAll === 'all' && consecutiveBookings.length > 1 ? 'serão excluídos' : 'será excluído'} permanentemente do sistema.
              <br />
              Turma: {booking?.class_name}
              <br />
              Horário: {applyToAll === 'all' && consecutiveBookings.length > 1
                ? `${consecutiveBookings[0]?.start_time?.slice(0, 5)} - ${consecutiveBookings[consecutiveBookings.length - 1]?.end_time?.slice(0, 5)}`
                : timeSlot.label}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBooking} 
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : `Excluir${applyToAll === 'all' && consecutiveBookings.length > 1 ? ` ${consecutiveBookings.length} horários` : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Edição (apenas admin) */}
      <RoomBookingEditDialog
        booking={bookingWithRoomType}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onBookingUpdated={() => onBookingCancelled?.()}
      />
    </>
  );
});

RoomTimeSlotCardNew.displayName = 'RoomTimeSlotCardNew';

export { RoomTimeSlotCardNew };