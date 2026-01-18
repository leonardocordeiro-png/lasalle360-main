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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoomBookingEditDialog } from "./RoomBookingEditDialog";

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
      const { error } = await supabase
        .from('room_bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado!",
        description: "O agendamento foi cancelado com sucesso.",
      });

      setShowCancelDialog(false);
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
      const { error } = await supabase
        .from('room_bookings')
        .delete()
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Agendamento excluído!",
        description: "O agendamento foi excluído permanentemente.",
      });

      setShowDeleteDialog(false);
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
  const bookingWithRoomType = booking ? { ...booking, room_type: roomType || booking.room_type || 'sala_google' } : null;

  return (
    <>
      <Card
        onClick={handleClick}
        className={cn(
          "relative p-4 transition-all duration-200 group",
          !isBooked && !isPast && "cursor-pointer hover:shadow-md",
          isBooked && "cursor-default",
          isSelected && "ring-2 ring-blue-500 bg-blue-50 border-blue-200",
          isBooked && !isSelected && "bg-red-50/50 border-red-200/50",
          isAvailable && !isSelected && "bg-emerald-50/30 border-emerald-200/50 hover:bg-emerald-50",
          isPast && "opacity-50 cursor-not-allowed bg-gray-50"
        )}
      >
        {/* Checkmark para selecionado */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <Check className="h-4 w-4 text-white" />
          </div>
        )}

        {/* Menu de ações para reservas */}
        {isBooked && !isPast && (isOwner || isAdmin) && (
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-white/80 hover:bg-white shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
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
                    onClick={() => setShowCancelDialog(true)}
                    className="text-amber-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancelar Agendamento
                  </DropdownMenuItem>
                )}
                {canDeleteBooking && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
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

        <div className="space-y-3">
          {/* Horário */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">
                {timeSlot.start} - {timeSlot.end}
              </span>
            </div>
            {!isBooked && getStatusBadge()}
            {isBooked && !isOwner && !isAdmin && getStatusBadge()}
          </div>

          {/* Informações do booking ou disponibilidade */}
          {isBooked ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium truncate">{booking.full_name}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate pl-6">
                {booking.class_name}
              </p>
              {isOwner && (
                <Badge variant="outline" className="text-xs mt-1 border-blue-300 text-blue-600">
                  Sua reserva
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {isPast ? "Horário passado" : "Clique para reservar"}
            </div>
          )}

          {/* Duração */}
          <div className="text-xs text-muted-foreground">
            Duração: {duration} min
          </div>
        </div>
      </Card>

      {/* Diálogo de Cancelamento */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento de{' '}
              <strong>{booking?.full_name}</strong>?
              <br />
              Turma: {booking?.class_name}
              <br />
              Horário: {timeSlot.label}
              <br /><br />
              O horário ficará disponível para outras reservas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelBooking} 
              className="bg-amber-600 hover:bg-amber-700"
            >
              Sim, cancelar
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
              O agendamento de <strong>{booking?.full_name}</strong> será excluído permanentemente do sistema.
              <br />
              Turma: {booking?.class_name}
              <br />
              Horário: {timeSlot.label}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBooking} 
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir Permanentemente"}
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