import { useState, useEffect, useCallback } from "react";
import { RoomFilterPanel } from "./RoomFilterPanel";
import { RoomAvailabilityGrid } from "./RoomAvailabilityGrid";
import { RoomBookingSummary } from "./RoomBookingSummary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Loader2 } from "lucide-react";

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

interface RoomBookingPageProps {
  onBookingCreated: () => void;
  initialRoomType?: 'sala_google' | 'laboratorio' | 'sala_criativa';
}

export function RoomBookingPage({ onBookingCreated, initialRoomType = 'sala_google' }: RoomBookingPageProps) {
  const [roomType, setRoomType] = useState<'sala_google' | 'laboratorio' | 'sala_criativa'>(initialRoomType);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [observations, setObservations] = useState("");

  const roomNames: Record<'sala_google' | 'laboratorio' | 'sala_criativa', string> = {
    sala_google: 'Sala Google',
    laboratorio: 'Laboratório',
    sala_criativa: 'Sala Criativa',
  };

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

  const fetchBookings = useCallback(async () => {
    setLoading(true);

    // Buscar bookings para o mês atual e próximo
    const fromDate = startOfMonth(selectedDate);
    const toDate = endOfMonth(addMonths(selectedDate, 1));

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
    } catch (error: any) {
      console.error('Error fetching room bookings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar agendamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, roomType]);

  useEffect(() => {
    fetchBookings();

    // Realtime subscription
    const channel = supabase
      .channel(`room-bookings-${roomType}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_bookings',
          filter: `room_type=eq.${roomType}`
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchBookings, roomType]);

  const handleRoomTypeChange = (newRoomType: 'sala_google' | 'laboratorio' | 'sala_criativa') => {
    setRoomType(newRoomType);
    setSelectedSlots([]); // Limpar seleção ao mudar sala
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlots([]); // Limpar seleção ao mudar data
  };

  const handleSlotToggle = (slot: TimeSlot) => {
    setSelectedSlots(prev => {
      const isAlreadySelected = prev.some(s => s.start === slot.start && s.end === slot.end);
      if (isAlreadySelected) {
        return prev.filter(s => !(s.start === slot.start && s.end === slot.end));
      } else {
        return [...prev, slot].sort((a, b) => a.start.localeCompare(b.start));
      }
    });
  };

  const handleBookingCreated = () => {
    fetchBookings();
    setObservations(""); // Limpar observações após criar reserva
    onBookingCreated();
  };

  const handleClearSelection = () => {
    setSelectedSlots([]);
    setObservations("");
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando disponibilidade...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Painel de Filtros - Esquerda */}
      <div className="lg:col-span-3">
        <RoomFilterPanel
          roomType={roomType}
          onRoomTypeChange={handleRoomTypeChange}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          observations={observations}
          onObservationsChange={setObservations}
        />
      </div>

      {/* Grade de Disponibilidade - Centro */}
      <div className="lg:col-span-6">
        <RoomAvailabilityGrid
          roomType={roomType}
          roomName={roomNames[roomType]}
          selectedDate={selectedDate}
          bookings={bookings}
          selectedSlots={selectedSlots}
          onSlotToggle={handleSlotToggle}
          onBookingCancelled={handleBookingCreated}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      </div>

      {/* Resumo da Reserva - Direita */}
      <div className="lg:col-span-3">
        <RoomBookingSummary
          roomType={roomType}
          roomName={roomNames[roomType]}
          selectedDate={selectedDate}
          selectedSlots={selectedSlots}
          observations={observations}
          onBookingCreated={handleBookingCreated}
          onClearSelection={handleClearSelection}
        />
      </div>
    </div>
  );
}