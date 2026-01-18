import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModernCalendarView } from '@/components/calendar/ModernCalendarView';

type ViewMode = 'day' | 'week';

interface AvailabilityTableProps {
  onBookingCreated: () => void;
  totalInventory: number;
}

export function AvailabilityTable({ onBookingCreated, totalInventory }: AvailabilityTableProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ModernCalendarView
          viewMode={viewMode}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onViewModeChange={(mode) => setViewMode(mode)}
          onBookingCreated={onBookingCreated}
          totalInventory={totalInventory}
        />
      </CardContent>
    </Card>
  );
}