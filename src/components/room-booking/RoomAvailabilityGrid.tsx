import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoomTimeSlotCardNew } from "./RoomTimeSlotCardNew";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, School, FlaskConical, Lightbulb } from "lucide-react";

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

  return (
    <Card className="flex-1">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl">
              Disponibilidade - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {format(selectedDate, "EEEE", { locale: ptBR })}
            </p>
          </div>
          
          {/* Legenda */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Disponível</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Reservado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Selecionado</span>
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
        {/* Informações da Sala */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="p-3 bg-primary/10 rounded-xl">
            <RoomIcon className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{currentRoom.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {currentRoom.capacity > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{currentRoom.capacity} lugares</span>
                </div>
              )}
              {currentRoom.resources.map((resource, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {resource}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600">{availableCount}</p>
            <p className="text-xs text-muted-foreground">horários livres</p>
          </div>
        </div>

        {/* Dica para administradores */}
        {isAdmin && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              👑 <strong>Administrador:</strong> Clique no menu (⋮) de qualquer reserva para editar, cancelar ou excluir.
            </p>
          </div>
        )}

        {/* Grid de Horários */}
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