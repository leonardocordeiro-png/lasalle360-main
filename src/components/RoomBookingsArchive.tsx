import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Calendar, 
  Clock, 
  Users, 
  MessageSquare, 
  Archive, 
  ChevronDown, 
  ChevronUp,
  School,
  FlaskConical,
  Lightbulb,
  History,
  Filter,
  Search
} from "lucide-react";
import { format, parseISO, isPast, isToday, isFuture, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";

interface RoomBooking {
  id: string;
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  observations: string | null;
  status: string;
  full_name: string;
  approval_status?: string;
}

interface RoomBookingsArchiveProps {
  auditorioBookings: RoomBooking[];
  laboratorioBookings: RoomBooking[];
  salaCriativaBookings: RoomBooking[];
}

export function RoomBookingsArchive({ 
  auditorioBookings, 
  laboratorioBookings, 
  salaCriativaBookings 
}: RoomBookingsArchiveProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [isExpanded, setIsExpanded] = useState(false);

  // Separar agendamentos passados dos atuais/futuros
  const separateBookings = (bookings: RoomBooking[]) => {
    const now = new Date();
    return bookings.reduce(
      (acc, booking) => {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
        if (isPast(bookingDateTime) && !isToday(bookingDateTime)) {
          acc.past.push(booking);
        } else {
          acc.current.push(booking);
        }
        return acc;
      },
      { past: [] as RoomBooking[], current: [] as RoomBooking[] }
    );
  };

  const auditorioSeparated = separateBookings(auditorioBookings);
  const laboratorioSeparated = separateBookings(laboratorioBookings);
  const salaCriativaSeparated = separateBookings(salaCriativaBookings);

  // Combinar todos os agendamentos passados
  const allPastBookings = [
    ...auditorioSeparated.past.map(b => ({ ...b, roomName: "Auditório", icon: School })),
    ...laboratorioSeparated.past.map(b => ({ ...b, roomName: "Laboratório", icon: FlaskConical })),
    ...salaCriativaSeparated.past.map(b => ({ ...b, roomName: "Sala Criativa", icon: Lightbulb }))
  ];

  // Filtrar agendamentos passados
  const filteredPastBookings = allPastBookings.filter(booking => {
    const matchesSearch = searchTerm === "" || 
      booking.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.observations?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRoom = selectedRoom === "all" || booking.room_type === selectedRoom;
    
    return matchesSearch && matchesRoom;
  });

  // Ordenar por data (mais recentes primeiro)
  const sortedPastBookings = filteredPastBookings.sort((a, b) => 
    new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime()
  );

  const totalPastBookings = allPastBookings.length;
  const hasPastBookings = totalPastBookings > 0;

  if (!hasPastBookings) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-background">
      <CardHeader>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Agendamentos Arquivados
                    <Badge variant="secondary" className="text-xs">
                      {totalPastBookings}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Agendamentos anteriores já realizados
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="space-y-4 mt-4">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por turma, nome ou observações..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Tabs value={selectedRoom} onValueChange={setSelectedRoom} className="w-full sm:w-auto">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                    <TabsTrigger value="auditorio" className="text-xs">Auditório</TabsTrigger>
                    <TabsTrigger value="laboratorio" className="text-xs">Lab.</TabsTrigger>
                    <TabsTrigger value="sala_criativa" className="text-xs">Criativa</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Lista de Agendamentos Passados */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedPastBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum agendamento encontrado com os filtros selecionados.</p>
                  </div>
                ) : (
                  sortedPastBookings.map((booking) => (
                    <Card 
                      key={booking.id} 
                      className="border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded">
                                <booking.icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{booking.roomName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(parseISO(booking.booking_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800">
                                <Clock className="h-3 w-3 mr-1" />
                                {booking.start_time} - {booking.end_time}
                              </Badge>
                            </div>

                            {/* Detalhes */}
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {booking.class_name}
                              </span>
                              <span className="text-xs">• {booking.full_name?.split(' ')[0]}</span>
                            </div>

                            {/* Observações */}
                            {booking.observations && (
                              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
                                <div className="flex items-start gap-1">
                                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>{booking.observations}</span>
                                </div>
                              </div>
                            )}

                            {/* Status de aprovação (se aplicável) */}
                            {booking.room_type === 'auditorio' && booking.approval_status && (
                              <div className="mt-2">
                                <Badge 
                                  variant={booking.approval_status === 'approved' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {booking.approval_status === 'approved' ? 'Aprovado' : 
                                   booking.approval_status === 'pending' ? 'Aguardando' : 
                                   booking.approval_status === 'rejected' ? 'Rejeitado' : booking.approval_status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Resumo */}
              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                Mostrando {sortedPastBookings.length} de {totalPastBookings} agendamentos arquivados
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
}
