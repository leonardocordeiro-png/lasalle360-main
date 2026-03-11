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

      // Buscar inventário do dia com cache
      const { data: inventoryData } = await supabase
        .from('chromebook_inventory')
        .select('total_available')
        .eq('date', dateStr)
        .maybeSingle();

      const dayTotalInventory = inventoryData?.total_available || totalInventory;

      // Filtrar bookings ativos do dia (otimizado)
      const dayBookings = bookings.filter(b => b.booking_date === dateStr && b.status === 'active');

      // LÓGICA CORRETA DE DISPONIBILIDADE:
      // 1. Chromebooks reservados ficam COMPROMETIDOS para o DIA INTEIRO
      // 2. Mesmo usuário com múltiplos horários → usa os MESMOS Chromebooks → pegar MAX
      // 3. Usuários diferentes → equipamentos distintos → SOMAR os máximos
      // 4. TODOS os horários do dia mostram a mesma disponibilidade
      
      // Calcular o MÁXIMO por usuário no dia inteiro
      const userMaxOnDay = new Map<string, number>();
      dayBookings.forEach(booking => {
        const currentMax = userMaxOnDay.get(booking.user_id) || 0;
        userMaxOnDay.set(booking.user_id, Math.max(currentMax, booking.quantity));
      });

      // Somar os máximos de cada usuário diferente = total comprometido no dia
      let totalCommitted = 0;
      userMaxOnDay.forEach(quantity => {
        totalCommitted += quantity;
      });

      // Disponibilidade é igual para TODOS os horários do dia
      const availableForDay = Math.max(0, dayTotalInventory - totalCommitted);

      // Aplicar a mesma disponibilidade para todos os slots
      for (const slot of timeSlots) {
        const cacheKey = `${dateStr}-${slot.start}-${slot.end}`;
        newCache.set(cacheKey, availableForDay);
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
      <Card className="flex-1 border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        {/* Gradient Date Header */}
        <div className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border-b border-border/40">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
                  Disponibilidade - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 capitalize">
                  {format(selectedDate, "EEEE", { locale: ptBR })}
                </p>
              </div>

              {/* Legend Pills */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Disponível
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] sm:text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Parcial
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[10px] sm:text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Lotado
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] sm:text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Selecionado
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  Bloqueado
                </span>
              </div>
            </div>

            {/* Contador de selecionados */}
            {selectedSlots.length > 0 && (
              <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 rounded-xl flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{selectedSlots.length}</span>
                </div>
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-medium">
                  horário(s) selecionado(s) para reserva
                </p>
              </div>
            )}
          </CardHeader>
        </div>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Resource Info Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/30">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2.5 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl ring-1 ring-primary/10 flex-shrink-0">
                <Chrome className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base sm:text-lg tracking-tight">Chromebooks</h3>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Laptop className="h-3 w-3" />
                    {totalInventory} unidades
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 rounded-md font-medium bg-primary/8 text-primary border-primary/15">
                    Equipamento de Aluno
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 rounded-md font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/15">
                    Entrega pela TI/TE
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 sm:flex-col sm:items-end self-end sm:self-center">
              <div className="text-right">
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{totalAvailableSlots}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">horários com vagas</p>
              </div>
            </div>
          </div>

          {/* Dica para administradores */}
          {isAdmin && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 border border-purple-200/60 dark:border-purple-800/60 rounded-xl">
              <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300">
                👑 <strong>Administrador:</strong> Clique no menu (⋮) de qualquer reserva para editar, cancelar, excluir ou <strong>transferir para outro usuário</strong>.
              </p>
            </div>
          )}

          {/* Grid de Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2.5 sm:gap-3">
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