import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Chrome, Laptop, GraduationCap, CalendarDays, Hash, Sparkles } from "lucide-react";
import { ptBR } from "date-fns/locale";

interface ChromebookFilterPanelProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  classGroupName: string;
  onClassNameChange: (className: string) => void;
  totalInventory: number;
}

export function ChromebookFilterPanel({
  selectedDate,
  onDateChange,
  quantity,
  onQuantityChange,
  classGroupName,
  onClassNameChange,
  totalInventory,
}: ChromebookFilterPanelProps) {
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

  const maxQuantity = Math.min(200, totalInventory);

  return (
    <Card className="h-fit sticky top-4 overflow-hidden border-0 shadow-xl bg-card/95 backdrop-blur-sm">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/80 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Agendar Chromebooks</h3>
            <p className="text-[11px] text-white/70 font-medium">Configure sua reserva</p>
          </div>
        </div>
      </div>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* Categoria */}
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Categoria
          </Label>
          <div className="relative group">
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/15 transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-sm">
              <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/20">
                <Chrome className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Chromebooks</p>
                <p className="text-[11px] text-muted-foreground">Equipamentos para aulas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Turma - Opcional */}
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            Turma <span className="font-normal normal-case text-[10px]">(Opcional)</span>
          </Label>
          <Input
            placeholder="Ex: 9º Ano A"
            value={classGroupName}
            onChange={(e) => onClassNameChange(e.target.value)}
            maxLength={50}
            className="bg-muted/30 border-muted/40 focus-visible:ring-primary/50 focus-visible:border-primary/40 rounded-lg text-sm h-9 transition-all duration-200"
          />
          <p className="text-[10px] text-muted-foreground/70 italic">
            Informe a turma se aplicável (campo opcional)
          </p>
        </div>

        {/* Informações do Equipamento */}
        <div className="flex items-center gap-2.5 p-2.5 bg-muted/30 rounded-lg border border-muted/20">
          <Laptop className="h-4 w-4 text-primary flex-shrink-0" />
          <div>
            <span className="font-medium text-xs text-foreground">Equipamento de Aluno</span>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Chromebook para uso pedagógico em sala.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
            </span>
          </div>
        </div>

        {/* Calendário */}
        <div className="space-y-2 w-full max-w-full overflow-hidden">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Selecionar Data
          </Label>
          <div className="w-full max-w-full overflow-hidden rounded-xl border border-muted/40 bg-muted/10">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              locale={ptBR}
              disabled={(date) => isWeekend(date) || isPastDate(date)}
              className="p-2 w-full max-w-full [&_table]:w-full [&_table]:table-fixed"
              classNames={{
                months: "flex flex-col w-full",
                month: "space-y-3 w-full",
                caption: "flex justify-center pt-1 relative items-center px-6",
                caption_label: "text-sm font-semibold",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-lg border border-input hover:bg-accent hover:text-accent-foreground transition-all duration-200",
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse table-fixed",
                head_row: "flex w-full justify-between",
                head_cell: "text-muted-foreground rounded-md w-[14.28%] font-medium text-[0.65rem] text-center uppercase",
                row: "flex w-full mt-1 justify-between",
                cell: "w-[14.28%] text-center text-sm p-0 relative flex items-center justify-center",
                day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center text-xs transition-all duration-200",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md",
                day_today: "bg-accent text-accent-foreground font-bold ring-1 ring-primary/30",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
                day_hidden: "invisible",
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground/50" />
            </span>
          </div>
        </div>

        {/* Quantidade */}
        <div className="space-y-3">
          <Label htmlFor="chromebook-quantity" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Quantidade de Chromebooks
          </Label>
          <div className="flex items-center gap-2.5 p-2.5 bg-muted/20 rounded-xl border border-muted/30">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Laptop className="h-4 w-4 text-primary" />
            </div>
            <Input
              id="chromebook-quantity"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity || ''}
              onChange={(e) => {
                const inputValue = e.target.value;
                if (inputValue === '') {
                  onQuantityChange(0);
                  return;
                }
                const value = parseInt(inputValue);
                if (!isNaN(value)) {
                  onQuantityChange(Math.min(Math.max(value, 1), maxQuantity));
                }
              }}
              onBlur={(e) => {
                const value = parseInt(e.target.value);
                if (isNaN(value) || value < 1) {
                  onQuantityChange(1);
                }
              }}
              className="w-full border-0 bg-transparent shadow-none focus-visible:ring-0 text-lg font-bold h-8 p-0"
              placeholder="1"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Máximo disponível: <span className="font-bold text-primary">{maxQuantity}</span>
          </p>
        </div>

        {/* Dica */}
        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border border-amber-200/60 dark:border-amber-800/60 rounded-xl">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
            💡 <strong>Dica:</strong> Selecione os horários desejados na grade ao lado e confirme sua reserva no painel de resumo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}