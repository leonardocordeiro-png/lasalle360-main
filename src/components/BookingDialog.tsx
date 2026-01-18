import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, CalendarCheck, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { bookingSchema, type BookingFormData } from '@/lib/validationSchemas';
import { logSecurityEvent, sanitizeString } from '@/lib/securityUtils';
import { calculateAvailableQuantity } from '@/lib/availabilityUtils'; // Import the RPC function
import { bookingEmailQueue } from '@/lib/bookingEmailQueue';

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  totalInventory: number; // New prop
  maxBookingQuantity: number; // New prop
}

const timeSlots = [
  { value: '07:30-08:20', label: '07:30 - 08:20' },
  { value: '08:20-09:10', label: '08:20 - 09:10' },
  { value: '09:10-10:00', label: '09:10 - 10:00' },
  { value: '10:20-11:10', label: '10:20 - 11:10' },
  { value: '11:10-12:00', label: '11:10 - 12:00' },
  { value: '12:00-12:50', label: '12:00 - 12:50' },
  { value: '13:30-14:20', label: '13:30 - 14:20' },
  { value: '14:20-15:10', label: '14:20 - 15:10' },
  { value: '15:10-16:00', label: '15:10 - 16:00' },
  { value: '16:00-16:50', label: '16:00 - 16:50' },
  { value: '16:50-17:40', label: '16:50 - 17:40' },
  { value: '17:40-18:00', label: '17:40 - 18:00' }
];


interface AvailabilityInfo {
  timeSlot: string;
  available: number;
  sufficient: boolean;
}

export default function BookingDialog({ open, onOpenChange, onSuccess, totalInventory, maxBookingQuantity }: BookingDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [availabilityInfo, setAvailabilityInfo] = useState<AvailabilityInfo[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [userProfile, setUserProfile] = useState<string>('');
  const requestIdRef = useRef(0);
  
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      className: '',
      quantity: 1,
      bookingDate: new Date(),
      timeSlots: [],
      purpose: ''
    }
  });

  // Carregar dados do usuário automaticamente
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        
        if (error) throw error;
        setUserProfile(data?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuário');
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Usuário');
      }
    };
    
    loadUserProfile();
  }, [user]);

  const checkAvailability = useCallback(async (date: Date, timeSlots: string[], quantity: number) => {
    if (!date || timeSlots.length === 0) {
      setAvailabilityInfo([]);
      return;
    }

    const currentId = ++requestIdRef.current;
    setCheckingAvailability(true);
    
    try {
      const dateStr = date.toISOString().split('T')[0];

      const results: AvailabilityInfo[] = [];
      for (const slot of timeSlots) {
        const [startTime, endTime] = slot.split('-');
        const available = await calculateAvailableQuantity(dateStr, startTime, endTime, totalInventory);
        results.push({
          timeSlot: slot,
          available,
          sufficient: available >= quantity
        });
      }

      // Atualiza estado apenas se esta ainda for a requisição mais recente
      if (currentId === requestIdRef.current) {
        setAvailabilityInfo(results);
      }
    } catch (error) {
      console.error('Error in checkAvailability:', error);
      await logSecurityEvent('availability_check_exception', 'booking', `${date.toISOString().split('T')[0]}`);
    } finally {
      if (currentId === requestIdRef.current) {
        setCheckingAvailability(false);
      }
    }
  }, [totalInventory]); // Add totalInventory to dependencies

  const handleSubmit = useCallback(async (data: BookingFormData) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário não autenticado.",
      });
      return;
    }

    // Verifica disponibilidade
    if (availabilityInfo.some(info => !info.sufficient)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Quantidade solicitada não disponível em todos os horários selecionados.",
      });
      return;
    }

    setLoading(true);

    try {
      const fullName = userProfile;
      const bookingDate = data.bookingDate.toISOString().split('T')[0];
      const sanitizedPurpose = sanitizeString(data.purpose);
      const sanitizedClassName = sanitizeString(data.className);

      // Criar agendamentos para cada horário selecionado
      const bookingsToCreate = data.timeSlots.map(timeSlot => {
        const [startTime, endTime] = timeSlot.split('-');
        
        return {
          user_id: user.id,
          full_name: fullName,
          class_name: sanitizedClassName,
          quantity: data.quantity,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
        };
      });

      // Inserir agendamentos
      const { data: insertedBookings, error } = await supabase
        .from('chromebook_bookings')
        .insert(bookingsToCreate)
        .select();

      if (error) {
        await logSecurityEvent('booking_creation_failed', 'booking', `${data.className}-${bookingDate}`);
        toast({
          variant: "destructive",
          title: "Erro ao criar agendamento",
          description: error.message,
        });
      } else {
        await logSecurityEvent('booking_creation_success', 'booking', `${data.className}-${bookingDate}`);
        
        // Create notification for the user
        await supabase.from('notifications' as any).insert({
          user_id: user.id,
          message: `Seu agendamento de ${data.quantity} Chromebook(s) para a turma ${sanitizedClassName} em ${format(data.bookingDate, 'dd/MM/yyyy')} foi confirmado.`,
          type: 'booking_confirmation',
          related_id: insertedBookings[0]?.id || null, // Link to the first booking if multiple
        } as any);

        // Add bookings to email queue for consolidated sending
        insertedBookings.forEach(booking => {
          bookingEmailQueue.addToQueue(user.id, {
            type: 'chromebook',
            booking: {
              class_name: booking.class_name,
              quantity: booking.quantity,
              booking_date: booking.booking_date,
              start_time: booking.start_time,
              end_time: booking.end_time,
            },
            userEmail: user.email!,
            userName: fullName,
          });
        });

        void supabase.functions.invoke('add-to-google-calendar', {
          body: {
            bookings: insertedBookings,
            userEmail: user.email,
            userName: fullName
          }
        }).catch((calendarError) => {
          console.error('Error adding to Google Calendar:', calendarError);
        });

        toast({
          title: "Agendamentos criados!",
          description: `${bookingsToCreate.length} agendamentos criados para ${format(data.bookingDate, 'dd/MM/yyyy')}. Você receberá um email de confirmação e os eventos foram adicionados ao seu Google Calendar.`,
        });
        
        // Reset e cleanup
        form.reset({
          className: '',
          quantity: 1,
          bookingDate: new Date(),
          timeSlots: [],
          purpose: ''
        });
        setAvailabilityInfo([]);
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      await logSecurityEvent('booking_creation_error', 'booking', `${data.className}-${data.bookingDate.toISOString().split('T')[0]}`);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro inesperado ao criar agendamento.",
      });
    } finally {
      setLoading(false);
    }
  }, [user, userProfile, availabilityInfo, onSuccess, onOpenChange, form, totalInventory]); // Add totalInventory to dependencies

  // Debounce hook para evitar múltiplas requisições
  const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  const watchDate = form.watch('bookingDate');
  const watchSlots = form.watch('timeSlots');
  const watchQty = form.watch('quantity');

  const availabilityKey = useMemo(() => {
    const dateStr = watchDate ? watchDate.toISOString().split('T')[0] : '';
    const slotsKey = Array.isArray(watchSlots) ? [...watchSlots].sort().join('|') : '';
    const qtyNum = typeof watchQty === 'number' ? watchQty : Number(watchQty) || 0;
    return `${dateStr}__${slotsKey}__${qtyNum}`;
  }, [watchDate, watchSlots, watchQty]);

  const debouncedKey = useDebounce(availabilityKey, 500);

  useEffect(() => {
    if (!debouncedKey) return;

    if (watchDate && Array.isArray(watchSlots) && watchSlots.length > 0 && watchQty) {
      checkAvailability(watchDate as Date, watchSlots as string[], Number(watchQty));
    } else {
      setAvailabilityInfo([]);
    }
  }, [debouncedKey, checkAvailability]);

  const selectedTimeSlots = form.watch('timeSlots') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
            <CalendarCheck className="h-5 w-5" />
            Novo Agendamento - {userProfile}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Selecione a turma, quantidade (máx. {maxBookingQuantity}) e horários desejados. Total disponível: {totalInventory} Chromebooks.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Class Name Input */}
              <FormField
                control={form.control}
                name="className"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Turma *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Digite o nome da turma (ex: 3A, 7B, EJA1)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade * (Máx: {maxBookingQuantity})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max={maxBookingQuantity}
                        placeholder="Quantos Chromebooks?"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Time Slots Selection */}
              <FormField
                control={form.control}
                name="timeSlots"
                render={() => (
                  <FormItem>
                    <FormLabel>Horários * (Selecione um ou mais)</FormLabel>
                    <Card className="p-4 max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {timeSlots.map((timeSlot) => (
                          <FormField
                            key={timeSlot.value}
                            control={form.control}
                            name="timeSlots"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(timeSlot.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, timeSlot.value])
                                        : field.onChange(
                                            field.value?.filter((value) => value !== timeSlot.value)
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {timeSlot.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </Card>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Selection */}
              <FormField
                control={form.control}
                name="bookingDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                    </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const maxDate = new Date();
                            maxDate.setMonth(maxDate.getMonth() + 3);
                            const dayOfWeek = date.getDay();
                            return date < today || date > maxDate || dayOfWeek === 0 || dayOfWeek === 6;
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>


            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Caso necessite de algo, por favor digite aqui..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Availability Information */}
            {(availabilityInfo.length > 0 || checkingAvailability) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Disponibilidade
                    {checkingAvailability && <Loader2 className="h-4 w-4 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checkingAvailability ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verificando disponibilidade...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {availabilityInfo.map((info, index) => (
                          <div 
                            key={index}
                            className={cn(
                              "p-2 rounded flex justify-between items-center bg-primary/10 text-foreground",
                              info.sufficient ? "border-success border" : "border-destructive border"
                            )}
                          >
                            <span>{info.timeSlot}</span>
                            <span className="font-medium">
                              {info.available} disponíveis
                              {!info.sufficient && " ⚠️"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {availabilityInfo.some(info => !info.sufficient) && (
                        <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 text-destructive-foreground rounded-lg">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">
                            Quantidade insuficiente para alguns horários selecionados
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap justify-end gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || checkingAvailability || availabilityInfo.some(info => !info.sufficient)}
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Check className="h-4 w-4 mr-2" />
                {loading ? 'Criando...' : checkingAvailability ? 'Verificando...' : 'Criar Agendamentos'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}