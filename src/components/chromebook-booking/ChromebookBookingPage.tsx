import { useState, useEffect, useCallback, useRef } from "react";
import { ChromebookFilterPanel } from "./ChromebookFilterPanel";
import { ChromebookAvailabilityGrid } from "./ChromebookAvailabilityGrid";
import { ChromebookBookingSummary } from "./ChromebookBookingSummary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Loader2 } from "lucide-react";

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

interface ChromebookBookingPageProps {
  onBookingCreated: () => void;
  totalInventory: number;
}

export function ChromebookBookingPage({ onBookingCreated, totalInventory }: ChromebookBookingPageProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<ChromebookBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [className, setClassName] = useState("");
  
  // Ref para armazenar a data atual sem causar re-renders
  const selectedDateRef = useRef<Date>(selectedDate);
  const isInitialMount = useRef(true);

  // Atualizar ref quando a data muda
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

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

  // Função de fetch estável que usa ref
  const fetchBookings = useCallback(async (dateToFetch: Date, showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }

    const fromDate = startOfMonth(dateToFetch);
    const toDate = endOfMonth(addMonths(dateToFetch, 1));

    try {
      const { data, error } = await supabase
        .from('chromebook_bookings')
        .select('*')
        .eq('status', 'active')
        .gte('booking_date', format(fromDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(toDate, 'yyyy-MM-dd'));

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching chromebook bookings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar agendamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Efeito inicial - apenas uma vez para carregar dados e configurar subscription
  useEffect(() => {
    fetchBookings(selectedDateRef.current, true);

    const channel = supabase
      .channel('chromebook-bookings-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chromebook_bookings'
        },
        () => {
          fetchBookings(selectedDateRef.current, false);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchBookings]);

  // Efeito separado para mudança de data (não recria subscription)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Buscar dados sem mostrar loading
    fetchBookings(selectedDate, false);
  }, [selectedDate, fetchBookings]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlots([]);
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
    fetchBookings(selectedDate, false);
    setSelectedSlots([]);
    setClassName("");
    setQuantity(1);
    onBookingCreated();
  };

  const handleClearSelection = () => {
    setSelectedSlots([]);
    setClassName("");
    setQuantity(1);
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      {/* Painel de Filtros - Esquerda */}
      <div className="lg:col-span-3 min-w-0">
        <ChromebookFilterPanel
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          quantity={quantity}
          onQuantityChange={setQuantity}
          classGroupName={className}
          onClassNameChange={setClassName}
          totalInventory={totalInventory}
        />
      </div>

      {/* Grade de Disponibilidade - Centro */}
      <div className="lg:col-span-6 min-w-0 overflow-hidden">
        <ChromebookAvailabilityGrid
          selectedDate={selectedDate}
          bookings={bookings}
          selectedSlots={selectedSlots}
          onSlotToggle={handleSlotToggle}
          onBookingCancelled={handleBookingCreated}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          totalInventory={totalInventory}
        />
      </div>

      {/* Resumo da Reserva - Direita */}
      <div className="lg:col-span-3 min-w-0">
        <ChromebookBookingSummary
          selectedDate={selectedDate}
          selectedSlots={selectedSlots}
          quantity={quantity}
          classGroupName={className}
          onBookingCreated={handleBookingCreated}
          onClearSelection={handleClearSelection}
          totalInventory={totalInventory}
        />
      </div>
    </div>
  );
}