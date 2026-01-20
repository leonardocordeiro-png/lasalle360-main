import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { intervalsOverlap } from '@/lib/timeUtils';
import { useAuth } from '@/hooks/useAuth';
import { Clock, Calendar, Users, BookOpen } from 'lucide-react';
import { calculateAvailableQuantity, getUserMaxQuantityOnDate } from '@/lib/availabilityUtils'; // Import RPC functions
import { bookingEmailQueue } from '@/lib/bookingEmailQueue';

interface QuickBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: string;
  selectedTime?: string;
  onBookingCreated: () => void;
  totalInventory: number; // New prop
}

export function QuickBookingModal({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  onBookingCreated,
  totalInventory // Use the prop
}: QuickBookingModalProps) {
  const { user } = useAuth();
  const [className, setClassName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [maxAvailable, setMaxAvailable] = useState(0); // Initialize to 0
  const [fullName, setFullName] = useState('');
  const [maxBookingQuantity, setMaxBookingQuantity] = useState(50); // Default, will be fetched

  useEffect(() => {
    if (open && user) {
      // Set user full name
      setFullName(user.user_metadata?.full_name || user.email || '');

      // Reset form fields
      setClassName('');
      setQuantity('1');

      // Fetch max booking quantity from system config
      fetchMaxBookingQuantity();

      // Fetch available quantity for the selected date/time
      if (selectedDate && selectedTime) {
        fetchAvailability();
      }
    }
  }, [open, selectedDate, selectedTime, user, totalInventory]); // Add totalInventory to dependencies

  const fetchMaxBookingQuantity = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'max_booking_quantity')
        .single();

      if (error) throw error;

      const maxQty = parseInt(String(data.config_value));
      setMaxBookingQuantity(maxQty || 50);
    } catch (error) {
      console.error('Error fetching max booking quantity:', error);
      setMaxBookingQuantity(50); // Default fallback
    }
  };

  const fetchAvailability = async () => {
    if (!selectedDate || !selectedTime || !user) return;

    try {
      const [startTime, endTime] = selectedTime.split('-');

      // Get available quantity using the RPC function
      const availableForSlot = await calculateAvailableQuantity(selectedDate, startTime, endTime, totalInventory);

      // Get current user's max quantity on this day
      const userCurrentMaxOnDay = await getUserMaxQuantityOnDate(user.id, selectedDate);

      // The actual available quantity for the current user is the sum of
      // what's available in the slot plus their own current max (since they can reuse)
      setMaxAvailable(availableForSlot + userCurrentMaxOnDay);
    } catch (error) {
      console.error('Error fetching availability:', error);
      setMaxAvailable(totalInventory); // Fallback to total inventory on error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate || !selectedTime) return;

    const requestedQuantity = parseInt(quantity);

    if (requestedQuantity <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "A quantidade deve ser maior que zero.",
        variant: "destructive"
      });
      return;
    }

    if (requestedQuantity > maxBookingQuantity) {
      toast({
        title: "Quantidade máxima excedida",
        description: `A quantidade máxima permitida por agendamento é ${maxBookingQuantity} Chromebook(s).`,
        variant: "destructive"
      });
      return;
    }

    if (requestedQuantity > maxAvailable) {
      toast({
        title: "Quantidade indisponível",
        description: `Apenas ${maxAvailable} Chromebook(s) disponível(is) para você neste horário.`,
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const [startTime, endTime] = selectedTime.split('-');

      const { data: newBooking, error } = await supabase
        .from('chromebook_bookings')
        .insert({
          user_id: user.id,
          class_name: className,
          booking_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          quantity: requestedQuantity,
          full_name: fullName,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Create notification for the user
      await supabase.from('notifications' as any).insert({
        user_id: user.id,
        message: `Seu agendamento de ${requestedQuantity} Chromebook(s) para a turma ${className} em ${format(parseISO(selectedDate), 'dd/MM/yyyy')} foi confirmado.`,
        type: 'booking_confirmation',
        related_id: newBooking.id,
      } as any);

      // Add booking to email queue for consolidated sending
      bookingEmailQueue.addToQueue(user.id, {
        type: 'chromebook',
        booking: {
          class_name: newBooking.class_name,
          quantity: newBooking.quantity,
          booking_date: newBooking.booking_date,
          start_time: newBooking.start_time,
          end_time: newBooking.end_time,
        },
        userEmail: user.email!,
        userName: fullName,
      });

      toast({
        title: "Agendamento realizado!",
        description: `${requestedQuantity} Chromebook(s) agendado(s) para ${className}`,
      });

      onBookingCreated();
      onOpenChange(false);
      setClassName('');
      setQuantity('1');
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar agendamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!selectedDate || !selectedTime) return null;

  const formattedDate = format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <BookOpen className="h-5 w-5" />
            Agendamento Rápido
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Preencha os campos abaixo para reservar Chromebooks rapidamente para sua turma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Date and Time Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{formattedDate}</p>
                <p className="text-xs text-muted-foreground">Data</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{selectedTime}</p>
                <p className="text-xs text-muted-foreground">Horário</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome do Solicitante</Label>
              <Input
                id="fullName"
                value={fullName}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="className">Turma</Label>
              <Input
                id="className"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Ex: 3º Ano A, 8º Ano B..."
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade de Chromebooks</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={Math.min(maxAvailable, maxBookingQuantity)}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Digite a quantidade"
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Disponível: {maxAvailable} | Máximo por agendamento: {maxBookingQuantity}
                <br />
                <span className="text-primary">
                  Múltiplos agendamentos no mesmo dia usam apenas a maior quantidade
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !className.trim()}
                className="flex-1"
              >
                {loading ? "Agendando..." : "Confirmar Agendamento"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}