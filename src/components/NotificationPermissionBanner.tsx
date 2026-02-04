import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, X } from 'lucide-react';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

interface NotificationPermissionBannerProps {
  onDismiss?: () => void;
}

export function NotificationPermissionBanner({ onDismiss }: NotificationPermissionBannerProps) {
  const { permission, isLoading, requestPermission, isSupported } = useNotificationPermission();

  if (!isSupported || isLoading || permission.granted || permission.denied) {
    return null;
  }

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted && onDismiss) {
      onDismiss();
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Alert className="border-blue-200 bg-blue-50/50 relative">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <AlertDescription className="text-blue-800">
            <div className="space-y-2">
              <p className="font-medium">
                Ative as notificações do navegador
              </p>
              <p className="text-sm text-blue-700">
                Receba alertas em tempo real quando houver novas aprovações pendentes. 
                Fique sempre atualizado sem precisar ficar verificando o sistema!
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button 
                  size="sm" 
                  onClick={handleEnable}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Ativar Notificações
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDismiss}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Agora não
                </Button>
              </div>
            </div>
          </AlertDescription>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="absolute top-2 right-2 h-8 w-8 p-0 text-blue-600 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  );
}
