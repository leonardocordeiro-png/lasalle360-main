import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, addDays, isSameDay, startOfWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TimeSlotCard } from './TimeSlotCard';
import { CalendarLegend } from './CalendarLegend';
import { QuickBookingModal } from './QuickBookingModal';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calculateAvailableQuantity } from '@/lib/availabilityUtils';
import { intervalsOverlap } from '@/lib/timeUtils';

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
}

interface ModernCalendarViewProps {
  viewMode: 'day' | 'week';
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: 'day' | 'week') => void;
  onBookingCreated: () => void;
  totalInventory: number; // New prop
}

const timeSlots = [
  '07:30-08:20', '08:20-09:10', '09:10-10:00',
  '10:20-11:10', '11:10-12:00', '12:00-12:50',
  '13:30-14:20', '14:20-15:10', '15:10-16:00', '16:00-16:50', '17:10-18:00'
];

export function ModernCalendarView({
  viewMode,
  currentDate,
  onDateChange,
  onViewModeChange,
  onBookingCreated,
  totalInventory // Use the prop
}: ModernCalendarViewProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string} | null>(null);
  const [bookingsCache, setBookingsCache] = useState<Map<string, Booking[]>>(new Map());
  const [availabilityCache, setAvailabilityCache] = useState<Map<string, number>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const days = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      // Retorna apenas dias úteis (segunda a sexta)
      return Array.from({ length: 5 }, (_, i) => addDays(start, i));
    }
  }, [currentDate, viewMode]);

  const dateRange = useMemo(() => {
    const startDate = days[0];
    const endDate = days[days.length - 1];
    return {
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd')
    };
  }, [days]);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        setIsAdmin(!!roleData);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchKey = `${dateRange.from}-${dateRange.to}`;
    
    // Verifica se já tem os dados no cache
    const cachedData = bookingsCache.get(fetchKey);
    if (cachedData) {
      setBookings(cachedData);
      setLoading(false);
      return;
    }

    // Se não tem no cache, faz o fetch com debounce
    const timeoutId = setTimeout(() => {
      fetchBookings(fetchKey);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [dateRange.from, dateRange.to, bookingsCache]);

  const fetchBookings = useCallback(async (fetchKey: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('chromebook_bookings')
        .select(`
          id,
          class_name,
          booking_date,
          start_time,
          end_time,
          status,
          user_id,
          quantity,
          full_name
        `)
        .gte('booking_date', dateRange.from)
        .lte('booking_date', dateRange.to)
        .eq('status', 'active')
        .order('booking_date')
        .order('start_time');

      if (error) throw error;
      
      const bookingsData = data || [];
      setBookings(bookingsData);
      
      // Atualiza o cache
      setBookingsCache(prev => new Map(prev.set(fetchKey, bookingsData)));
      
      // Pre-calculate availability for all slots
      await preCalculateAvailability(bookingsData);
      
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar agendamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  const preCalculateAvailability = async (bookingsData: Booking[]) => {
    const newCache = new Map<string, number>();
    
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Get inventory for this date, defaulting to totalInventory prop
      const { data: inventoryData } = await supabase
        .from('chromebook_inventory')
        .select('total_available')
        .eq('date', dateStr)
        .maybeSingle();

      const dayTotalInventory = inventoryData?.total_available || totalInventory; // Use prop as fallback
      
      // First, get the maximum quantity each user has booked on this entire day
      const dayBookings = bookingsData.filter(b => b.booking_date === dateStr);
      const userMaxOnDay = new Map<string, number>();
      
      dayBookings.forEach(booking => {
        const currentMax = userMaxOnDay.get(booking.user_id) || 0;
        userMaxOnDay.set(booking.user_id, Math.max(currentMax, booking.quantity));
      });
      
      for (const timeSlot of timeSlots) {
        const [startTime, endTime] = timeSlot.split('-');
        const cacheKey = `${dateStr}-${timeSlot}`;
        
        // Determine users with bookings overlapping this specific slot using numeric comparisons
        const usersInSlot = new Set<string>();
        dayBookings.forEach(b => {
          if (intervalsOverlap(startTime, endTime, b.start_time, b.end_time)) {
            usersInSlot.add(b.user_id);
          }
        });
        
        // Sum the maximum quantities of users who have bookings in this slot
        let bookedQuantity = 0;
        usersInSlot.forEach(userId => {
          bookedQuantity += userMaxOnDay.get(userId) || 0;
        });
        
        const available = Math.max(0, dayTotalInventory - bookedQuantity);
        newCache.set(cacheKey, available);
      }
    }
    
    setAvailabilityCache(newCache);
  };

  const getBookingsForSlot = useCallback((date: Date, timeSlot: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const [startTime, endTime] = timeSlot.split('-');
    
    // Use numeric overlap to avoid string comparison pitfalls
    return bookings.filter(booking => 
      booking.booking_date === dateStr &&
      intervalsOverlap(startTime, endTime, booking.start_time, booking.end_time)
    );
  }, [bookings]);

  const getAvailableCount = useCallback((date: Date, timeSlot: string): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const cacheKey = `${dateStr}-${timeSlot}`;
    return availabilityCache.get(cacheKey) || 0;
  }, [availabilityCache]);

  const handleSlotClick = (date: Date, timeSlot: string) => {
    const availableCount = getAvailableCount(date, timeSlot);
    if (availableCount > 0) {
      setSelectedSlot({
        date: format(date, 'yyyy-MM-dd'),
        time: timeSlot
      });
      setQuickBookingOpen(true);
    }
  };

  const handleQuickBookingCreated = useCallback(() => {
    // Limpa os caches para forçar recarregamento
    setBookingsCache(new Map());
    setAvailabilityCache(new Map());
    const fetchKey = `${dateRange.from}-${dateRange.to}`;
    fetchBookings(fetchKey);
    onBookingCreated();
    setQuickBookingOpen(false);
    setSelectedSlot(null);
  }, [fetchBookings, onBookingCreated, dateRange.from, dateRange.to]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const days = viewMode === 'day' ? 1 : 7;
    const newDate = addDays(currentDate, direction === 'next' ? days : -days);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-20 bg-muted animate-pulse rounded-md" />
            <div className="h-10 w-20 bg-muted animate-pulse rounded-md" />
          </div>
          <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="text-center text-sm text-muted-foreground">
          Carregando disponibilidade...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('day')}
            className="transition-all duration-200"
          >
            Dia
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('week')}
            className="transition-all duration-200"
          >
            Semana
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('prev')}
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            onClick={goToToday}
            className="min-w-[120px] text-sm font-medium"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {viewMode === 'day' 
              ? format(currentDate, "d 'de' MMMM", { locale: ptBR })
              : `${format(days[0], 'd MMM', { locale: ptBR })} - ${format(days[days.length - 1], 'd MMM', { locale: ptBR })}`
            }
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate('next')}
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px] lg:min-w-full"> {/* Ensure minimum width for scrolling */}
          {/* Days Header */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-6 gap-2 mb-2">
              <div className="h-12" /> {/* Empty cell for time column */}
              {days.map((day) => (
                <Card key={day.toISOString()} className={cn(
                  "h-12 flex items-center justify-center transition-colors",
                  isSameDay(day, new Date()) && "bg-primary/10 border-primary/20"
                )}>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEE', { locale: ptBR })}
                    </div>
                    <div className={cn(
                      "text-sm font-medium",
                      isSameDay(day, new Date()) && "text-primary font-semibold"
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Time Slots */}
          <div className="space-y-2">
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot} className={cn(
                "grid gap-2",
                viewMode === 'week' ? "grid-cols-6" : "grid-cols-2"
              )}>
                {/* Time Label */}
                <div className="flex items-center justify-center h-16 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">
                    {timeSlot}
                  </span>
                </div>

                {/* Day Slots */}
                {days.map((day) => {
                  const dayKey = day.toISOString();
                  const bookingsInSlot = getBookingsForSlot(day, timeSlot);
                  const availableCount = getAvailableCount(day, timeSlot);
                  
                  return (
                    <TimeSlotCard
                      key={`${dayKey}-${timeSlot}`}
                      date={day}
                      timeSlot={timeSlot}
                      bookings={bookingsInSlot}
                      availableCount={availableCount}
                      onClick={() => handleSlotClick(day, timeSlot)}
                      onBookingCancelled={handleQuickBookingCreated}
                      className="h-16"
                      isAdmin={isAdmin}
                      currentUserId={currentUserId || undefined}
                      totalInventory={totalInventory} // Pass totalInventory
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <CalendarLegend />

      {/* Quick Booking Modal */}
      <QuickBookingModal
        open={quickBookingOpen}
        onOpenChange={setQuickBookingOpen}
        selectedDate={selectedSlot?.date}
        selectedTime={selectedSlot?.time}
        onBookingCreated={handleQuickBookingCreated}
        totalInventory={totalInventory} // Pass totalInventory
      />
    </div>
  );
}