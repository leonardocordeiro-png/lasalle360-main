import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export function CalendarLegend() {
  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4" />
          Legenda de Disponibilidade
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs bg-emerald-500 text-white">
              25/30
            </Badge>
            <span className="text-sm text-muted-foreground">
              Alta disponibilidade (70%+)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs bg-amber-500 text-white">
              15/30
            </Badge>
            <span className="text-sm text-muted-foreground">
              Média disponibilidade (30-69%)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs">
              5/30
            </Badge>
            <span className="text-sm text-muted-foreground">
              Baixa disponibilidade (&lt; 30%)
            </span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Clique em um horário disponível para fazer um agendamento rápido.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}