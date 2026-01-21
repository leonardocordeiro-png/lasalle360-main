import { useMemo, useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChromebookTimeSlotCard } from "./ChromebookTimeSlotCard";
import { ChromebookTransferDialog } from "./ChromebookTransferDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Chrome, Laptop, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { intervalsOverlap } from "@/lib/timeUtils";

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

interface ChromebookAvailabilityGridProps {
  selectedDate: Date;
  bookings: ChromebookBooking[];
  selectedSlots: TimeSlot[];
  onSlotToggle: (slot: TimeSlot) => void;
  onBookingCancelled: () => void;
  isAdmin: boolean;
  currentUserId: string | null;
  totalInventory: number;
}

export function ChromebookAvailabilityGrid({
  selectedDate,
  bookings,
  selectedSlots,
  onSlotToggle,
  onBookingCancelled,
  isAdmin,
  currentUserId,
  totalInventory,
}: ChromebookAvailabilityGridProps) {
  const [availabilityCache, setAvailabilityCache] = useState<Map<string, number>>(new Map());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedBookingForTransfer, setSelectedBookingForTransfer] = useState<ChromebookBooking | null>(null);
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

  // Calcular disponibilidade para cada slot (lógica cumulativa)
  // Chromebooks reservados em um horário permanecem indisponíveis nos horários seguintes
  useEffect(() => {
    const calculateAvailability = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const newCache = new Map<string, number>();

      // Buscar inventário do dia
      const { data: inventoryData } = await supabase
        .from('chromebook_inventory')
        .select('total_available')
        .eq('date', dateStr)
        .maybeSingle();

      const dayTotalInventory = inventoryData?.total_available || totalInventory;

      // Filtrar bookings ativos do dia
      const dayBookings = bookings.filter(b => b.booking_date === dateStr && b.status === 'active');

      // Função para converter horário em minutos para comparação
      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      for (const slot of timeSlots) {
        const cacheKey = `${dateStr}-${slot.start}-${slot.end}`;
        const slotStartMinutes = timeToMinutes(slot.start);
        const slotEndMinutes = timeToMinutes(slot.end);

        // LÓGICA CUMULATIVA CORRIGIDA:
        // Para cada slot, somar TODAS as quantidades de bookings que começaram até o início deste slot
        // Cada booking representa um conjunto separado de Chromebooks que estão fora
        // Não há consolidação por usuário - se um usuário fez 2 bookings, ambos são contados
        
        let bookedQuantity = 0;
        
        dayBookings.forEach(booking => {
          const bookingStartMinutes = timeToMinutes(booking.start_time);
          
          // Se o booking começou antes ou no início deste slot, ele impacta a disponibilidade
          // OU se o booking começa durante este slot
          if (bookingStartMinutes <= slotStartMinutes || 
              (bookingStartMinutes > slotStartMinutes && bookingStartMinutes < slotEndMinutes)) {
            bookedQuantity += booking.quantity;
          }
        });

        const available = Math.max(0, dayTotalInventory - bookedQuantity);
        newCache.set(cacheKey, available);
      }

      setAvailabilityCache(newCache);
    };

    calculateAvailability();
  }, [selectedDate, bookings, totalInventory, timeSlots]);

  // Fetch calendar blocks for the selected date
  useEffect(() => {
    const fetchBlocks = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('calendar_blocks')
        .select('*')
        .eq('resource_type', 'chromebook')
        .eq('block_date', dateStr);

      if (!error && data) {
        setCalendarBlocks(data as CalendarBlock[]);
      }
    };

    fetchBlocks();
  }, [selectedDate]);

  const isSlotBlocked = useCallback((slot: { start: string; end: string }): CalendarBlock | null => {
    return calendarBlocks.find(block =>
      intervalsOverlap(slot.start, slot.end, block.start_time.slice(0, 5), block.end_time.slice(0, 5))
    ) || null;
  }, [calendarBlocks]);

  const getBookingsForSlot = useCallback((slot: { start: string; end: string }): ChromebookBooking[] => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return bookings.filter(booking =>
      booking.booking_date === dateStr &&
      intervalsOverlap(slot.start, slot.end, booking.start_time, booking.end_time)
    );
  }, [bookings, selectedDate]);

  const getAvailableCount = useCallback((slot: { start: string; end: string }): number => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const cacheKey = `${dateStr}-${slot.start}-${slot.end}`;
    // Retorna totalInventory como padrão enquanto o cache não está calculado
    // para evitar flash de "Lotado" ao mudar de data
    const cached = availabilityCache.get(cacheKey);
    return cached !== undefined ? cached : totalInventory;
  }, [selectedDate, availabilityCache, totalInventory]);

  const isPastDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(selectedDate);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isSlotSelected = (slot: { start: string; end: string }) => {
    return selectedSlots.some(s => s.start === slot.start && s.end === slot.end);
  };

  const handleTransferClick = (booking: ChromebookBooking) => {
    setSelectedBookingForTransfer(booking);
    setTransferDialogOpen(true);
  };

  const totalAvailableSlots = timeSlots.filter(slot => getAvailableCount(slot) > 0).length;
  const totalBookedToday = bookings.filter(b => b.booking_date === format(selectedDate, 'yyyy-MM-dd')).length;

  return (
    <>
      <Card className="flex-1">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle className="text-xl">
                Disponibilidade - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </p>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="whitespace-nowrap">Disponível</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="whitespace-nowrap">Parcial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <span className="whitespace-nowrap">Lotado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span className="whitespace-nowrap">Selecionado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0" />
                <span className="whitespace-nowrap">Bloqueado</span>
              </div>
            </div>
          </div>

          {/* Contador de selecionados */}
          {selectedSlots.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{selectedSlots.length}</strong> horário(s) selecionado(s) para reserva
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Informações do Recurso */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Chrome className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Chromebooks</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Laptop className="h-4 w-4" />
                  <span>{totalInventory} unidades</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Equipamento de Aluno
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Entrega pela TI/TE
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-600">{totalAvailableSlots}</p>
              <p className="text-xs text-muted-foreground">horários com vagas</p>
            </div>
          </div>

          {/* Dica para administradores */}
          {isAdmin && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                👑 <strong>Administrador:</strong> Clique no menu (⋮) de qualquer reserva para editar, cancelar, excluir ou <strong>transferir para outro usuário</strong>.
              </p>
            </div>
          )}

          {/* Grid de Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {timeSlots.map((slot) => {
              const slotBookings = getBookingsForSlot(slot);
              const availableCount = getAvailableCount(slot);
              const isSelected = isSlotSelected(slot);
              const blockInfo = isSlotBlocked(slot);

              return (
                <ChromebookTimeSlotCard
                  key={slot.label}
                  timeSlot={slot}
                  bookings={slotBookings}
                  availableCount={availableCount}
                  totalInventory={totalInventory}
                  isSelected={isSelected}
                  isPast={isPastDate()}
                  onSelect={() => !blockInfo && onSlotToggle(slot)}
                  onBookingCancelled={onBookingCancelled}
                  onTransferClick={handleTransferClick}
                  isAdmin={isAdmin}
                  currentUserId={currentUserId || undefined}
                  isBlocked={!!blockInfo}
                  blockReason={blockInfo?.reason}
                  blockDescription={blockInfo?.description || blockInfo?.reserved_for}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Transferência */}
      <ChromebookTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        booking={selectedBookingForTransfer}
        onTransferComplete={onBookingCancelled}
      />
    </>
  );
}