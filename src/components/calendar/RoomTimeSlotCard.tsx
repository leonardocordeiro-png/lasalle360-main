import React, { memo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
}

interface RoomTimeSlotCardProps {
  date: Date;
  timeSlot: string;
  booking: RoomBooking | null;
  onClick: () => void;
  onBookingCancelled?: () => void;
  isPast: boolean;
  className?: string;
  isAdmin?: boolean;
  currentUserId?: string;
}

const RoomTimeSlotCard = memo(({
  date,
  timeSlot,
  booking,
  onClick,
  onBookingCancelled,
  isPast,
  className,
  isAdmin = false,
  currentUserId
}: RoomTimeSlotCardProps) => {
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const canCancelBooking = booking && (isAdmin || booking.user_id === currentUserId);

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

  const handleBookingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canCancelBooking) {
      setShowCancelDialog(true);
    }
  };

  return (
    <>
      <Card 
        className={cn(
          'group relative transition-all duration-200 hover:shadow-lg rounded-xl overflow-hidden',
          booking
            ? 'bg-gradient-to-br from-destructive/10 to-destructive/20 border-destructive/40'
            : 'bg-gradient-to-br from-success/10 to-success/20 border-success/40',
          isPast ? 'opacity-60 cursor-not-allowed' : (!booking ? 'cursor-pointer' : 'cursor-default'),
          className
        )}
        onClick={!isPast && !booking ? onClick : undefined}
      >
        <CardContent className="p-3 h-full flex flex-col justify-between">
          {booking ? (
            <div
              className={cn(
                "flex items-start justify-between gap-2 text-sm bg-background/50 backdrop-blur-sm rounded-md px-2 py-1.5 transition-colors h-full",
                canCancelBooking && "hover:bg-background/80 cursor-pointer"
              )}
              onClick={handleBookingClick}
            >
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {booking.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {booking.class_name}
                  </p>
                  {booking.observations && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 cursor-help">
                            <Info className="h-3 w-3" />
                            <span className="truncate">Observações</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{booking.observations}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              {canCancelBooking && (
                <X className="h-4 w-4 text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              {!isPast && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-success"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento de{' '}
              <strong>{booking?.full_name}</strong>?
              <br />
              Turma: {booking?.class_name}
              {booking?.observations && (
                <>
                  <br />
                  Observações: {booking.observations}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking} className="bg-destructive hover:bg-destructive/90">
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

RoomTimeSlotCard.displayName = 'RoomTimeSlotCard';

export { RoomTimeSlotCard };