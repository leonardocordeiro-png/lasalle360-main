import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoomTimeSlotCardNew } from "./RoomTimeSlotCardNew";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, School, FlaskConical, Lightbulb, Calendar as CalendarIcon, Crown, CheckCircle2 } from "lucide-react";

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

interface TimeSlot {
  start: string;
  end: string;
}

interface RoomAvailabilityGridProps {
  roomType: 'auditorio' | 'laboratorio' | 'sala_criativa';
  roomName: string;
  selectedDate: Date;
  bookings: RoomBooking[];
  selectedSlots: TimeSlot[];
  onSlotToggle: (slot: TimeSlot) => void;
  onBookingCancelled: () => void;
  isAdmin: boolean;
  currentUserId: string | null;
}

export function RoomAvailabilityGrid({
  roomType,
  roomName,
  selectedDate,
  bookings,
  selectedSlots,
  onSlotToggle,
  onBookingCancelled,
  isAdmin,
  currentUserId,
}: RoomAvailabilityGridProps) {
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

  const roomInfo = {
    auditorio: {
      name: "Auditório",
      icon: School,
      capacity: 200,
      resources: ["Projetor", "Equipamento de Som", "200 lugares"],
    },
    laboratorio: {
      name: "Laboratório",
      icon: FlaskConical,
      capacity: 35,
      resources: ["Bancadas", "Projetor", "Equipamentos"],
    },
    sala_criativa: {
      name: "Sala Criativa",
      icon: Lightbulb,
      capacity: 0,
      resources: ["Materiais Criativos", "Computadores", "Mesas Colaborativas"],
    },
  };

  const currentRoom = roomInfo[roomType];
  const RoomIcon = currentRoom.icon;

  const getBookingForSlot = useCallback((slot: { start: string; end: string }): RoomBooking | null => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const normalize = (t?: string | null) => (t ? t.slice(0, 5) : '');

    return (
      bookings.find(
        (b) =>
          b.booking_date === dateStr &&
          normalize(b.start_time) === slot.start &&
          normalize(b.end_time) === slot.end,
      ) || null
    );
  }, [bookings, selectedDate]);

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

  const availableCount = timeSlots.filter(slot => !getBookingForSlot(slot)).length;

  const getRoomGradient = () => {
    if (roomType === 'auditorio') return 'from-blue-600 via-blue-500 to-sky-500 dark:from-blue-700 dark:via-blue-600 dark:to-sky-600';
    if (roomType === 'laboratorio') return 'from-purple-600 via-purple-500 to-violet-500 dark:from-purple-700 dark:via-purple-600 dark:to-violet-600';
    return 'from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600';
  };

  const getRoomIconBg = () => {
    if (roomType === 'auditorio') return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 ring-blue-200/50 dark:ring-blue-800/30';
    if (roomType === 'laboratorio') return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 ring-purple-200/50 dark:ring-purple-800/30';
    return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 ring-amber-200/50 dark:ring-amber-800/30';
  };

  const getRoomBorderColor = () => {
    if (roomType === 'auditorio') return 'border-blue-200/60 dark:border-blue-800/40';
    if (roomType === 'laboratorio') return 'border-purple-200/60 dark:border-purple-800/40';
    return 'border-amber-200/60 dark:border-amber-800/40';
  };

  return (
    <Card className="flex-1 border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
      {/* Gradient Date Header */}
      <div className={`bg-gradient-to-br ${getRoomGradient()} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Disponibilidade - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-[11px] text-white/70 font-medium capitalize">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          {/* Legend Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-white/90 font-medium">Disponível</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[11px] text-white/90 font-medium">Reservado</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg">
              <div className="w-2 h-2 rounded-full bg-sky-300" />
              <span className="text-[11px] text-white/90 font-medium">Selecionado</span>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Room Info Card */}
        <div className={`relative overflow-hidden rounded-xl border ${getRoomBorderColor()} p-4`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ring-2 flex-shrink-0 ${getRoomIconBg()}`}>
              <RoomIcon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base">{currentRoom.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {currentRoom.capacity > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                    <Users className="h-3 w-3" />
                    <span>{currentRoom.capacity} lugares</span>
                  </div>
                )}
                {currentRoom.resources.map((resource, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] px-2 py-0 h-5 rounded-md font-medium">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">{availableCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">horários livres</p>
            </div>
          </div>
        </div>

        {/* Selection Counter */}
        {selectedSlots.length > 0 && (
          <div className="relative overflow-hidden rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-r from-blue-50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                <strong>{selectedSlots.length}</strong> horário(s) selecionado(s) para reserva
              </p>
            </div>
          </div>
        )}

        {/* Admin Tip */}
        {isAdmin && (
          <div className="relative overflow-hidden rounded-xl border border-purple-200/60 dark:border-purple-800/40 bg-gradient-to-r from-purple-50 to-violet-50/50 dark:from-purple-950/30 dark:to-violet-950/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <strong>Administrador:</strong> Clique no menu (⋮) de qualquer reserva para editar, cancelar ou excluir.
              </p>
            </div>
          </div>
        )}

        {/* Time Slots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {timeSlots.map((slot) => {
            const booking = getBookingForSlot(slot);
            const isSelected = isSlotSelected(slot);

            return (
              <RoomTimeSlotCardNew
                key={slot.label}
                timeSlot={slot}
                booking={booking}
                isSelected={isSelected}
                isPast={isPastDate()}
                onSelect={() => onSlotToggle(slot)}
                onBookingCancelled={onBookingCancelled}
                isAdmin={isAdmin}
                currentUserId={currentUserId || undefined}
                roomType={roomType}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}