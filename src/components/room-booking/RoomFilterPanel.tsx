import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, School, FlaskConical, DoorOpen, Lightbulb, MessageSquare } from "lucide-react";
import { ptBR } from "date-fns/locale";

interface RoomFilterPanelProps {
  roomType: 'auditorio' | 'laboratorio' | 'sala_criativa';
  onRoomTypeChange: (roomType: 'auditorio' | 'laboratorio' | 'sala_criativa') => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  observations: string;
  onObservationsChange: (observations: string) => void;
}

export function RoomFilterPanel({
  roomType,
  onRoomTypeChange,
  selectedDate,
  onDateChange,
  observations,
  onObservationsChange,
}: RoomFilterPanelProps) {
  const roomOptions = [
    {
      value: 'auditorio' as const,
      name: "Auditório",
      icon: School,
      description: "200 lugares, projetor e som",
    },
    {
      value: 'laboratorio' as const,
      name: "Laboratório",
      icon: FlaskConical,
      description: "Laboratório de Química e Física",
    },
    {
      value: 'sala_criativa' as const,
      name: "Sala Criativa",
      icon: Lightbulb,
      description: "Espaço para atividades criativas",
    },
  ];

  const currentRoom = roomOptions.find(r => r.value === roomType) || roomOptions[0];
  const RoomIcon = currentRoom.icon;

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const getRoomColor = (value: string) => {
    if (value === 'auditorio') return { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200/60 dark:border-blue-800/40', ring: 'ring-blue-500' };
    if (value === 'laboratorio') return { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200/60 dark:border-purple-800/40', ring: 'ring-purple-500' };
    return { bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/60 dark:border-amber-800/40', ring: 'ring-amber-500' };
  };

  return (
    <Card className="h-fit sticky top-4 border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-500 dark:from-purple-700 dark:via-purple-600 dark:to-indigo-600 p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
            <Filter className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Reservar Sala</h3>
            <p className="text-[11px] text-white/70 font-medium">Selecione a sala, data e horários</p>
          </div>
        </div>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Categoria */}
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Categoria
          </Label>
          <div className="relative overflow-hidden flex items-center gap-3 p-3.5 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-xl border border-primary/15">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative p-2 bg-primary/10 rounded-lg ring-2 ring-primary/20">
              <DoorOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="relative">
              <p className="font-semibold text-sm">Salas e Laboratórios</p>
              <p className="text-[11px] text-muted-foreground">Ambientes para aulas</p>
            </div>
          </div>
        </div>

        {/* Sala Específica */}
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Sala Específica
          </Label>
          <Select value={roomType} onValueChange={(value) => onRoomTypeChange(value as 'auditorio' | 'laboratorio' | 'sala_criativa')}>
            <SelectTrigger className="rounded-xl border-border/50 h-10">
              <SelectValue placeholder="Selecione a sala" />
            </SelectTrigger>
            <SelectContent>
              {roomOptions.map((room) => {
                const Icon = room.icon;
                return (
                  <SelectItem key={room.value} value={room.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{room.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Info da sala selecionada */}
          {(() => {
            const colors = getRoomColor(roomType);
            return (
              <div className={`relative overflow-hidden p-3 rounded-xl border ${colors.border} bg-gradient-to-br from-${roomType === 'auditorio' ? 'blue' : roomType === 'laboratorio' ? 'purple' : 'amber'}-50/50 dark:from-${roomType === 'auditorio' ? 'blue' : roomType === 'laboratorio' ? 'purple' : 'amber'}-950/20 to-transparent mt-2`}>
                <div className="absolute top-0 right-0 w-12 h-12 bg-current opacity-[0.03] rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                    <RoomIcon className={`h-4 w-4 ${colors.text}`} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm block">{currentRoom.name}</span>
                    <p className="text-[11px] text-muted-foreground">{currentRoom.description}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Calendário */}
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Selecionar Data
          </Label>
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              locale={ptBR}
              disabled={(date) => isPastDate(date)}
              className="w-full"
            />
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Observações / Solicitações
          </Label>
          <Textarea
            placeholder="Precisa de ajuda para configurar equipamentos? Necessita de recursos especiais? Descreva aqui..."
            value={observations}
            onChange={(e) => onObservationsChange(e.target.value)}
            rows={4}
            maxLength={500}
            className="resize-none rounded-xl border-border/40 text-sm"
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {observations.length}/500 caracteres
          </p>
          <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 rounded-lg">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Use este campo para informar se precisa de suporte técnico, recursos adicionais ou qualquer outra necessidade.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}