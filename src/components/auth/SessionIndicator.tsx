import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw } from 'lucide-react';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

interface SessionIndicatorProps {
  showIndicator?: boolean;
  compact?: boolean;
}

export function SessionIndicator({ showIndicator = true, compact = false }: SessionIndicatorProps) {
  const { timeRemaining, formattedTimeRemaining, extendSession } = useSessionTimeout();
  const [isVisible, setIsVisible] = useState(false);

  // Mostrar indicador apenas quando restar menos de 15 minutos
  useEffect(() => {
    const fifteenMinutes = 15 * 60 * 1000;
    setIsVisible(timeRemaining <= fifteenMinutes && timeRemaining > 0);
  }, [timeRemaining]);

  if (!showIndicator || !isVisible) {
    return null;
  }

  const getVariant = () => {
    const fiveMinutes = 5 * 60 * 1000;
    if (timeRemaining <= fiveMinutes) {
      return 'destructive';
    }
    const tenMinutes = 10 * 60 * 1000;
    if (timeRemaining <= tenMinutes) {
      return 'secondary';
    }
    return 'outline';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Badge variant={getVariant()} className="text-xs">
          {formattedTimeRemaining}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sessão:</span>
        <Badge variant={getVariant()} className="text-xs font-mono">
          {formattedTimeRemaining}
        </Badge>
      </div>
      
      {timeRemaining <= 5 * 60 * 1000 && (
        <Button
          size="sm"
          variant="outline"
          onClick={extendSession}
          className="h-6 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Estender
        </Button>
      )}
    </div>
  );
}
