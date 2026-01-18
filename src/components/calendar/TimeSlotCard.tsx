import React, { memo, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Users, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvailabilityBadge } from './AvailabilityBadge';
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

interface Booking {
  id: string;
  class_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
  quantity: number;
  full_name: string;
  profiles?: {
    full_name: string;
  };
}

interface TimeSlotCardProps {
  date: Date;
  timeSlot: string;
  bookings: Booking[];
  availableCount: number;
  onClick: () => void;
  onBookingCancelled?: () => void;
  className?: string;
  isAdmin?: boolean;
  currentUserId?: string;
  totalInventory: number; // New prop
}

const TimeSlotCard = memo(({
  date,
  timeSlot,
  bookings,
  availableCount,
  onClick,
  onBookingCancelled,
  className,
  isAdmin = false,
  currentUserId,
  totalInventory // Use the prop
}: TimeSlotCardProps) => {
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const isToday = isSameDay(date, new Date());
  const isPast = date < new Date() && !isToday;

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    try {
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({ status: 'cancelled' })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado!",
        description: "O agendamento foi cancelado com sucesso.",
      });

      setSelectedBooking(null);
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

  const canCancelBooking = (booking: Booking) => {
    return isAdmin || booking.user_id === currentUserId;
  };

  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    if (canCancelBooking(booking)) {
      setSelectedBooking(booking);
    }
  };

  const getBackgroundIntensity = () => {
    if (bookings.length === 0) return 'bg-muted hover:bg-muted/80 border-muted-foreground/20';
    return 'bg-card hover:bg-accent/10 border-border';
  };

  return (
    <>
      <Card 
        className={cn(
          "group cursor-pointer transition-all duration-200 hover:shadow-md",
          getBackgroundIntensity(),
          isPast && "opacity-60 cursor-not-allowed",
          isToday && "ring-2 ring-primary/20",
          className
        )}
        onClick={!isPast && availableCount > 0 ? onClick : undefined}
      >
        <CardContent className="p-3 h-full flex flex-col justify-between">
          {bookings.length > 0 ? (
            <div className="space-y-1 max-h-full overflow-y-auto">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className={cn(
                    "flex items-center justify-between gap-2 text-xs bg-background/50 rounded px-2 py-1 transition-colors",
                    canCancelBooking(booking) && "hover:bg-background/80 cursor-pointer"
                  )}
                  onClick={(e) => handleBookingClick(e, booking)}
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-muted-foreground">
                      {booking.profiles?.full_name || booking.full_name}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs h-4 px-1 flex-shrink-0">
                    {booking.quantity}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              {!isPast && availableCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={selectedBooking !== null} onOpenChange={() => setSelectedBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento de{' '}
              <strong>{selectedBooking?.profiles?.full_name || selectedBooking?.full_name}</strong>?
              <br />
              Turma: {selectedBooking?.class_name}
              <br />
              Quantidade: {selectedBooking?.quantity} chromebooks
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

TimeSlotCard.displayName = 'TimeSlotCard';

export { TimeSlotCard };