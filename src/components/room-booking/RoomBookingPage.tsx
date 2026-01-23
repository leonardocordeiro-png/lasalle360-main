import { useState, useEffect, useCallback, useRef } from "react";
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
  initialRoomType?: 'auditorio' | 'laboratorio' | 'sala_criativa';
}

export function RoomBookingPage({ onBookingCreated, initialRoomType = 'auditorio' }: RoomBookingPageProps) {
  const [roomType, setRoomType] = useState<'auditorio' | 'laboratorio' | 'sala_criativa'>(initialRoomType);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [observations, setObservations] = useState("");

  // Refs para armazenar valores atuais sem causar re-renders
  const selectedDateRef = useRef<Date>(selectedDate);
  const roomTypeRef = useRef<'auditorio' | 'laboratorio' | 'sala_criativa'>(roomType);
  const isInitialMount = useRef(true);

  const roomNames: Record<'auditorio' | 'laboratorio' | 'sala_criativa', string> = {
    auditorio: 'Auditório',
    laboratorio: 'Laboratório',
    sala_criativa: 'Sala Criativa',
  };

  // Atualizar refs quando os valores mudam
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    roomTypeRef.current = roomType;
  }, [roomType]);

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

  // Função de fetch estável que recebe parâmetros
  const fetchBookings = useCallback(async (dateToFetch: Date, roomTypeToFetch: string, showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }

    const fromDate = startOfMonth(dateToFetch);
    const toDate = endOfMonth(addMonths(dateToFetch, 1));

    try {
      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('room_type', roomTypeToFetch)
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
  }, []);

  // Efeito inicial - configura subscription apenas uma vez por roomType
  useEffect(() => {
    fetchBookings(selectedDateRef.current, roomType, true);

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
          fetchBookings(selectedDateRef.current, roomTypeRef.current, false);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchBookings, roomType]);

  // Efeito separado para mudança de data (não recria subscription)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchBookings(selectedDate, roomType, false);
  }, [selectedDate, fetchBookings, roomType]);

  const handleRoomTypeChange = (newRoomType: 'auditorio' | 'laboratorio' | 'sala_criativa') => {
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
    fetchBookings(selectedDate, roomType, false);
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