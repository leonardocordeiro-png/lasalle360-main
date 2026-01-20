import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Info } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, isWeekend, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QuickRoomBookingModal } from "./QuickRoomBookingModal";
import { RoomTimeSlotCard } from "./RoomTimeSlotCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { intervalsOverlap } from "@/lib/timeUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarLegend } from "./CalendarLegend"; // Reusing the legend for consistency

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

interface CalendarBlock {
  id: string;
  resource_type: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  description: string | null;
  reserved_for: string | null;
}

interface RoomCalendarViewProps {
  roomType: 'sala_google' | 'laboratorio';
  roomName: string;
  onBookingCreated: () => void;
}

type ViewMode = 'week' | 'month';

export function RoomCalendarView({ roomType, roomName, onBookingCreated }: RoomCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ start: string; end: string } | null>(null);
  const [showQuickBooking, setShowQuickBooking] = useState(false);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([]);

  const timeSlots = useMemo(() => [
    { start: "07:30", end: "08:20", label: "07:30 - 08:20" },
    { start: "08:20", end: "09:10", label: "08:20 - 09:10" },
    { start: "09:10", end: "10:00", label: "09:10 - 10:00" },
    { start: "10:20", end: "11:10", label: "10:20 - 11:10" },
    { start: "11:10", end: "12:00", label: "11:10 - 12:00" },
    { start: "12:00", end: "12:50", label: "12:00 - 12:50" },
    { start: "13:30", end: "14:20", label: "13:30 - 14:20" },
    { start: "14:20", end: "15:10", label: "14:20 - 15:10" },
    { start: "15:10", end: "16:00", label: "15:10 - 16:00" },
    { start: "16:00", end: "16:50", label: "16:00 - 16:50" },
    { start: "17:10", end: "18:00", label: "17:10 - 18:00" },
  ], []);

  const daysInWeek = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 5 }, (_, i) => addDays(start, i)); // Mon-Fri
  }, [currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay(); // 0 for Sunday, 1 for Monday
  const paddingDaysStart = Array.from({ length: firstDayOfWeek }, (_, i) =>
    addDays(monthStart, -(firstDayOfWeek - i))
  );
  const allDaysInMonthGrid = [...paddingDaysStart, ...daysInMonth];

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
    fetchBookings();
  }, [currentDate, roomType, viewMode]);

  const fetchBookings = async () => {
    setLoading(true);
    let fromDate: Date;
    let toDate: Date;

    if (viewMode === 'week') {
      fromDate = daysInWeek[0];
      toDate = daysInWeek[daysInWeek.length - 1];
    } else { // month view
      fromDate = startOfMonth(currentDate);
      toDate = endOfMonth(currentDate);
    }

    try {
      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('room_type', roomType)
        .eq('status', 'active')
        .gte('booking_date', format(fromDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(toDate, 'yyyy-MM-dd'));

      if (error) throw error;
      setBookings(data || []);

      // Fetch blocks
      const { data: blockData, error: blockError } = await supabase
        .from('calendar_blocks')
        .select('*')
        .eq('resource_type', roomType)
        .gte('block_date', format(fromDate, 'yyyy-MM-dd'))
        .lte('block_date', format(toDate, 'yyyy-MM-dd'));

      if (!blockError) {
        setCalendarBlocks(blockData as CalendarBlock[]);
      }
    } catch (error: any) {
      console.error('Error fetching room data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do calendário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isSlotBlocked = useCallback((date: Date, slotLabel: string): CalendarBlock | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const [start] = (slotLabel as string).split(' - ');

    return calendarBlocks.find(block =>
      block.block_date === dateStr &&
      block.start_time.slice(0, 5) === start
    ) || null;
  }, [calendarBlocks]);

  const isDayBlocked = useCallback((date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarBlocks.some(block => block.block_date === dateStr);
  }, [calendarBlocks]);

  const getBookingsForSlot = useCallback((date: Date, slot: { start: string; end: string }): RoomBooking | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const normalize = (t?: string | null) => (t ? t.slice(0, 5) : '');

    return (
      bookings.find(
        (b) =>
          b.booking_date === dateStr &&
          normalize(b.start_time) === slot.start &&
          normalize(b.end_time) === slot.end,
      ) || null
    );
  }, [bookings]);

  const getBookingsForDay = useCallback((date: Date): RoomBooking[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter((b) => b.booking_date === dateStr);
  }, [bookings]);

  const handleDayClickInMonthView = (day: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(day);
    checkDate.setHours(0, 0, 0, 0);

    if (isWeekend(day) || checkDate < today) {
      return;
    }
    setSelectedDate(day);
  };

  const handleTimeSlotClick = (date: Date, time: { start: string; end: string }) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setShowQuickBooking(true);
  };

  const handleQuickBookingCreated = useCallback(() => {
    onBookingCreated();
    fetchBookings(); // Re-fetch bookings to update calendar
    setShowQuickBooking(false);
    setSelectedDate(null);
    setSelectedTime(null);
  }, [onBookingCreated]);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(prev => addDays(prev, direction === 'next' ? 7 : -7));
    } else { // month view
      setCurrentDate(prev => (direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1)));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null); // Clear selected day in month view
  };

  const weekDaysLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const monthDaysLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const renderLoadingState = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <TabsList>
            <TabsTrigger value="week" className="gap-2">
              Semana
            </TabsTrigger>
            <TabsTrigger value="month" className="gap-2">
              Mês
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
            <CalendarIcon className="h-4 w-4 mr-2" />
            {viewMode === 'week'
              ? `${format(daysInWeek[0], 'd MMM', { locale: ptBR })} - ${format(daysInWeek[daysInWeek.length - 1], 'd MMM', { locale: ptBR })}`
              : format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
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

      {loading ? renderLoadingState() : (
        <>
          {viewMode === 'week' ? (
            <div className="space-y-4">
              {/* Week Days Header */}
              <div className="grid grid-cols-6 gap-2">
                <div className="h-12" /> {/* Empty cell for time column */}
                {daysInWeek.map((day) => (
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

              {/* Time Slots for Week View */}
              <div className="space-y-2">
                {timeSlots.map((timeSlot) => (
                  <div key={timeSlot.label} className="grid grid-cols-6 gap-2">
                    {/* Time Label */}
                    <div className="flex items-center justify-center h-20 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">
                        {timeSlot.label}
                      </span>
                    </div>

                    {/* Day Slots */}
                    {daysInWeek.map((day) => {
                      const dayKey = day.toISOString();
                      const booking = getBookingsForSlot(day, timeSlot);
                      const isPast = day < new Date() && !isSameDay(day, new Date());

                      return (
                        <RoomTimeSlotCard
                          key={`${dayKey}-${timeSlot.label}`}
                          date={day}
                          timeSlot={timeSlot.label}
                          booking={booking}
                          onClick={() => handleTimeSlotClick(day, timeSlot)}
                          onBookingCancelled={handleQuickBookingCreated}
                          isPast={isPast}
                          className="h-20"
                          isAdmin={isAdmin}
                          currentUserId={currentUserId || undefined}
                          isBlocked={!!isSlotBlocked(day, timeSlot.label)}
                          blockReason={isSlotBlocked(day, timeSlot.label)?.reason}
                          blockDescription={isSlotBlocked(day, timeSlot.label)?.description || isSlotBlocked(day, timeSlot.label)?.reserved_for}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : ( /* Month View */
            <div className="space-y-6">
              <Card className="p-6">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {monthDaysLabels.map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-muted-foreground p-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {allDaysInMonthGrid.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const checkDate = new Date(day);
                    checkDate.setHours(0, 0, 0, 0);
                    const isPast = checkDate < today;
                    const isWeekendDay = isWeekend(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isDisabled = isPast || isWeekendDay || !isCurrentMonth;
                    const dayBookings = getBookingsForDay(day);
                    const uniqueUsers = [...new Set(dayBookings.map(b => b.full_name))];
                    const dayHasBlocks = isDayBlocked(day);

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDayClickInMonthView(day)}
                        disabled={isDisabled}
                        className={cn(
                          "aspect-square p-1 rounded-lg text-sm transition-all flex flex-col items-center justify-start",
                          "hover:bg-accent disabled:cursor-not-allowed",
                          isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                          isToday(day) && "bg-primary/10 font-bold",
                          isSelected && "bg-primary text-primary-foreground font-bold",
                          isDisabled && "opacity-40",
                          dayHasBlocks && !isSelected && "bg-gray-100 dark:bg-gray-800"
                        )}
                      >
                        <span className="font-semibold">{format(day, 'd')}</span>
                        {dayHasBlocks && !isDisabled && !isSelected && (
                          <Lock className="h-2 w-2 text-gray-400 mt-0.5" />
                        )}
                        {uniqueUsers.length > 0 && !isDisabled && (
                          <div className="text-[9px] leading-tight mt-0.5 w-full overflow-hidden">
                            {uniqueUsers.slice(0, 2).map((name, i) => (
                              <div key={i} className="truncate" title={name}>
                                {name.split(' ')[0]}
                              </div>
                            ))}
                            {uniqueUsers.length > 2 && (
                              <div className="text-[8px] opacity-70">+{uniqueUsers.length - 2}</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>

              {selectedDate && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Horários - {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {timeSlots.map((slot) => {
                      const booking = getBookingsForSlot(selectedDate, slot);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const checkDate = new Date(selectedDate);
                      checkDate.setHours(0, 0, 0, 0);
                      const isPast = checkDate < today;

                      return (
                        <div key={slot.label} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground text-center">
                            {slot.label}
                          </p>
                          <RoomTimeSlotCard
                            date={selectedDate}
                            timeSlot={slot.label}
                            booking={booking}
                            onClick={() => handleTimeSlotClick(selectedDate, slot)}
                            onBookingCancelled={handleQuickBookingCreated}
                            isPast={isPast}
                            className="h-20"
                            isAdmin={isAdmin}
                            currentUserId={currentUserId || undefined}
                            isBlocked={!!isSlotBlocked(selectedDate, slot.label)}
                            blockReason={isSlotBlocked(selectedDate, slot.label)?.reason}
                            blockDescription={isSlotBlocked(selectedDate, slot.label)?.description || isSlotBlocked(selectedDate, slot.label)?.reserved_for}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <CalendarLegend />

      <QuickRoomBookingModal
        open={showQuickBooking}
        onOpenChange={setShowQuickBooking}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        roomType={roomType}
        roomName={roomName}
        onBookingCreated={handleQuickBookingCreated}
      />
    </div>
  );
}