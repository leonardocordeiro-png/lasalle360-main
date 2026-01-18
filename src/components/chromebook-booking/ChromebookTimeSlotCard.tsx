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
import { cn } from "@/lib/utils";
import { Clock, User, MoreVertical, Trash2, X, ArrowRightLeft, Chrome } from "lucide-react";
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
}: ChromebookTimeSlotCardProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ChromebookBooking | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasBookings = bookings.length > 0;
  const isFull = availableCount === 0;
  const isPartial = availableCount > 0 && availableCount < totalInventory && hasBookings;
  const isAvailable = availableCount > 0;

  const getStatusColor = () => {
    if (isSelected) return "border-blue-500 bg-blue-50 dark:bg-blue-950";
    if (isFull) return "border-red-200 bg-red-50 dark:bg-red-950";
    if (isPartial) return "border-amber-200 bg-amber-50 dark:bg-amber-950";
    return "border-emerald-200 bg-emerald-50 dark:bg-emerald-950 hover:border-emerald-400";
  };

  const getStatusBadge = () => {
    if (isFull) {
      return <Badge variant="destructive" className="text-xs whitespace-nowrap">Lotado</Badge>;
    }
    if (isPartial) {
      return <Badge className="text-xs bg-amber-500 hover:bg-amber-600 whitespace-nowrap">{availableCount} disponíveis</Badge>;
    }
    return <Badge className="text-xs bg-emerald-500 hover:bg-emerald-600 whitespace-nowrap">{availableCount} disponíveis</Badge>;
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
      const { error } = await supabase
        .from('chromebook_bookings')
        .delete()
        .eq('id', selectedBooking.id);

      if (error) throw error;

      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído permanentemente.",
      });

      onBookingCancelled();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir agendamento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
      setSelectedBooking(null);
    }
  };

  const canManageBooking = (booking: ChromebookBooking) => {
    return isAdmin || booking.user_id === currentUserId;
  };

  return (
    <>
      <Card
        className={cn(
          "p-3 transition-all duration-200 cursor-pointer border-2 min-w-0 overflow-hidden",
          getStatusColor(),
          isPast && "opacity-50 cursor-not-allowed",
          isSelected && "ring-2 ring-blue-500 ring-offset-2"
        )}
        onClick={() => !isPast && isAvailable && onSelect()}
      >
        <div className="space-y-2 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm whitespace-nowrap">{timeSlot.label}</span>
            </div>
            {getStatusBadge()}
          </div>

          {/* Bookings List */}
          {hasBookings && (
            <div className="space-y-2 mt-2 pt-2 border-t">
              {bookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between text-xs bg-background/50 rounded p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-medium">{booking.full_name}</span>
                      <span className="text-muted-foreground ml-1">({booking.class_name})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      <Chrome className="h-3 w-3 mr-1" />
                      {booking.quantity}
                    </Badge>
                    {canManageBooking(booking) && !isPast && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Permanentemente
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
              {bookings.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{bookings.length - 3} mais agendamentos
                </p>
              )}
            </div>
          )}

          {/* Empty State */}
          {!hasBookings && isAvailable && (
            <p className="text-xs text-muted-foreground text-center py-2">
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
            <AlertDialogTitle>Excluir Permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será removido permanentemente do sistema.
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
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}