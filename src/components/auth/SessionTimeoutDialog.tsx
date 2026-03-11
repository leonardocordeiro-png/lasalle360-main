import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutDialogProps {
  isOpen: boolean;
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
  warningLevel?: 'warning' | 'final';
}

export function SessionTimeoutDialog({
  isOpen,
  timeRemaining,
  onExtend,
  onLogout,
  warningLevel = 'warning'
}: SessionTimeoutDialogProps) {
  const [countdown, setCountdown] = useState(timeRemaining);
  const totalTime = warningLevel === 'final' ? 60 * 1000 : 5 * 60 * 1000; // 1 min ou 5 min
  const progress = ((totalTime - countdown) / totalTime) * 100;

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      const interval = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, countdown]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isFinal = warningLevel === 'final';
  const timeColor = isFinal ? 'text-red-600' : 'text-amber-600';
  const bgColor = isFinal ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const progressColor = isFinal ? 'bg-red-500' : 'bg-amber-500';

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className={`${bgColor} border-2 max-w-md`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFinal ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">Sessão Expirando</span>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-amber-600" />
                <span className="text-amber-800">Aviso de Sessão</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-700">
            {isFinal ? (
              <>
                Sua sessão será encerrada em <span className={`font-bold ${timeColor}`}>{formatTime(countdown)}</span>.
                <br />
                Salve seu trabalho imediatamente!
              </>
            ) : (
              <>
                Sua sessão expirará em <span className={`font-bold ${timeColor}`}>{formatTime(countdown)}</span> por inatividade.
                <br />
                Deseja estender sua sessão?
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tempo restante</span>
              <Badge variant={isFinal ? 'destructive' : 'secondary'} className={timeColor}>
                {formatTime(countdown)}
              </Badge>
            </div>
            <Progress 
              value={progress} 
              className={`h-2 ${isFinal ? 'bg-red-100' : 'bg-amber-100'}`}
            />
            <div 
              className={`h-1 ${progressColor} rounded-full transition-all duration-1000`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {isFinal ? (
              <>
                <Button
                  variant="outline"
                  onClick={onLogout}
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair Agora
                </Button>
                <Button
                  onClick={onExtend}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Estender Sessão
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onLogout}
                  className="flex-1"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
                <Button
                  onClick={onExtend}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Estender Sessão
                </Button>
              </>
            )}
          </div>

          {/* Security Notice */}
          <div className={`p-3 rounded-lg ${isFinal ? 'bg-red-100' : 'bg-amber-100'} border ${isFinal ? 'border-red-200' : 'border-amber-200'}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${timeColor}`} />
              <div className="text-xs">
                <p className={`font-semibold ${isFinal ? 'text-red-800' : 'text-amber-800'}`}>
                  Segurança
                </p>
                <p className={`${isFinal ? 'text-red-700' : 'text-amber-700'}`}>
                  {isFinal 
                    ? 'Por segurança, sessões inativas são encerradas automaticamente.'
                    : 'Esta medida protege sua conta em caso de computadores compartilhados.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
