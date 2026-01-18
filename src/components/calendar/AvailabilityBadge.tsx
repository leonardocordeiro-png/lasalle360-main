import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface AvailabilityBadgeProps {
  available: number;
  total: number;
  variant?: 'success' | 'warning' | 'destructive' | 'secondary' | 'default';
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function AvailabilityBadge({
  available,
  total,
  variant,
  size = 'default',
  showIcon = false,
  className
}: AvailabilityBadgeProps) {
  const percentage = (available / total) * 100;
  
  const getVariant = () => {
    if (variant) return variant;
    if (percentage >= 70) return 'default';
    if (percentage >= 30) return 'default';
    if (percentage > 0) return 'destructive';
    return 'secondary';
  };

  const getIcon = () => {
    if (percentage >= 70) return <CheckCircle className="h-3 w-3" />;
    if (percentage >= 30) return <AlertTriangle className="h-3 w-3" />;
    if (percentage > 0) return <XCircle className="h-3 w-3" />;
    return null;
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-1.5 py-0.5 h-5';
      case 'lg':
        return 'text-sm px-3 py-1 h-7';
      default:
        return 'text-xs px-2 py-1 h-6';
    }
  };

  return (
    <Badge
      variant={getVariant() as any}
      className={cn(
        "font-medium flex items-center gap-1",
        percentage >= 70 && "bg-emerald-500 text-white",
        percentage >= 30 && percentage < 70 && "bg-amber-500 text-white",
        getSizeClasses(),
        className
      )}
    >
      {showIcon && getIcon()}
      <span>{available}</span>
      <span className="text-muted-foreground">/{total}</span>
    </Badge>
  );
}