import { supabase } from '@/integrations/supabase/client';
import { intervalsOverlap } from '@/lib/timeUtils';

interface Booking {
  id: string;
  user_id: string;
  quantity: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

/**
 * Calculates the available quantity for a specific time slot considering that
 * the same user can reuse equipment across different time slots on the same day.
 * Only the maximum quantity booked by a user on a given day is counted towards inventory usage.
 */
export async function calculateAvailableQuantity(
  date: string,
  startTime: string,
  endTime: string,
  totalInventory: number = 200
): Promise<number> {
  try {
    // Get all active bookings for the entire day
    // We need all day bookings to calculate max per user correctly
    const { data: bookingsData, error } = await supabase
      .from('chromebook_bookings')
      .select('user_id, quantity, start_time, end_time')
      .eq('booking_date', date)
      .eq('status', 'active');

    if (error) throw error;

    // First, calculate the maximum quantity each user has booked on this entire day
    const userMaxOnDay = new Map<string, number>();
    bookingsData?.forEach(booking => {
      const currentMax = userMaxOnDay.get(booking.user_id) || 0;
      userMaxOnDay.set(booking.user_id, Math.max(currentMax, booking.quantity));
    });

    // Then, identify users who have bookings overlapping with this specific time slot
    const usersInSlot = new Set<string>();
    bookingsData?.forEach(booking => {
      if (intervalsOverlap(startTime, endTime, booking.start_time, booking.end_time)) {
        usersInSlot.add(booking.user_id);
      }
    });

    // Calculate total booked (sum of max quantities for users in this slot)
    let bookedQuantity = 0;
    usersInSlot.forEach(userId => {
      bookedQuantity += userMaxOnDay.get(userId) || 0;
    });
    
    return Math.max(0, totalInventory - bookedQuantity);
  } catch (error) {
    console.error('Error calculating availability:', error);
    return totalInventory;
  }
}

/**
 * Gets the maximum quantity already booked by a user on a specific date
 */
export async function getUserMaxQuantityOnDate(
  userId: string,
  date: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('chromebook_bookings')
      .select('quantity')
      .eq('booking_date', date)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;

    return data?.reduce((max, b) => Math.max(max, b.quantity), 0) || 0;
  } catch (error) {
    console.error('Error getting user max quantity:', error);
    return 0;
  }
}

/**
 * Validates if a booking can be made considering user consolidation rules
 */
export async function validateBookingAvailability(
  date: string,
  startTime: string,
  endTime: string,
  requestedQuantity: number,
  userId: string,
  excludeBookingId?: string
): Promise<{ available: boolean; message?: string }> {
  try {
    // Get inventory
    const { data: inventoryData } = await supabase
      .from('chromebook_inventory')
      .select('total_available')
      .eq('date', date)
      .maybeSingle();

    const totalInventory = inventoryData?.total_available || 200;

    // Get user's current max on this date
    const userMaxOnDate = await getUserMaxQuantityOnDate(userId, date);

    // Get available quantity
    const available = await calculateAvailableQuantity(date, startTime, endTime, totalInventory);

    // Check if user's new quantity would exceed availability
    // If the new quantity is higher than their current max, we need that extra amount to be available
    const additionalNeeded = Math.max(0, requestedQuantity - userMaxOnDate);

    if (additionalNeeded > available) {
      return {
        available: false,
        message: `Apenas ${available + userMaxOnDate} Chromebook(s) disponível(is) para você neste horário.`
      };
    }

    return { available: true };
  } catch (error) {
    console.error('Error validating booking availability:', error);
    return {
      available: false,
      message: 'Erro ao validar disponibilidade'
    };
  }
}
