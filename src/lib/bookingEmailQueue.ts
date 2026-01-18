import { supabase } from "@/integrations/supabase/client";

interface ChromebookBooking {
  class_name: string;
  quantity: number;
  booking_date: string;
  start_time: string;
  end_time: string;
}

interface RoomBooking {
  class_name: string;
  room_name: string;
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  observations?: string;
}

interface PendingBooking {
  type: 'chromebook' | 'room';
  booking: ChromebookBooking | RoomBooking;
  userEmail: string;
  userName: string;
}

interface UserQueue {
  chromebooks: ChromebookBooking[];
  rooms: RoomBooking[];
  userEmail: string;
  userName: string;
}

class BookingEmailQueue {
  private queue: Map<string, UserQueue>;
  private timers: Map<string, NodeJS.Timeout>;
  private readonly CONSOLIDATION_TIME = 10000; // 10 seconds

  constructor() {
    this.queue = new Map();
    this.timers = new Map();
  }

  addToQueue(userId: string, pendingBooking: PendingBooking): void {
    console.log(`[BookingEmailQueue] Adding ${pendingBooking.type} booking for user ${userId}`);
    
    // Get or create user queue
    let userQueue = this.queue.get(userId);
    if (!userQueue) {
      userQueue = {
        chromebooks: [],
        rooms: [],
        userEmail: pendingBooking.userEmail,
        userName: pendingBooking.userName,
      };
      this.queue.set(userId, userQueue);
    }

    // Add booking to appropriate array
    if (pendingBooking.type === 'chromebook') {
      userQueue.chromebooks.push(pendingBooking.booking as ChromebookBooking);
    } else if (pendingBooking.type === 'room') {
      userQueue.rooms.push(pendingBooking.booking as RoomBooking);
    }

    // Clear existing timer if any
    const existingTimer = this.timers.get(userId);
    if (existingTimer) {
      console.log(`[BookingEmailQueue] Resetting timer for user ${userId}`);
      clearTimeout(existingTimer);
    }

    // Set new timer
    const newTimer = setTimeout(() => {
      console.log(`[BookingEmailQueue] Timer expired for user ${userId}, sending consolidated email`);
      this.sendConsolidatedEmail(userId);
    }, this.CONSOLIDATION_TIME);

    this.timers.set(userId, newTimer);
    console.log(`[BookingEmailQueue] Timer set for ${this.CONSOLIDATION_TIME}ms`);
  }

  private async sendConsolidatedEmail(userId: string): Promise<void> {
    const userQueue = this.queue.get(userId);
    
    if (!userQueue) {
      console.log(`[BookingEmailQueue] No queue found for user ${userId}`);
      return;
    }

    const hasChromebooks = userQueue.chromebooks.length > 0;
    const hasRooms = userQueue.rooms.length > 0;

    if (!hasChromebooks && !hasRooms) {
      console.log(`[BookingEmailQueue] No bookings to send for user ${userId}`);
      this.cleanup(userId);
      return;
    }

    try {
      console.log(`[BookingEmailQueue] Sending consolidated email for user ${userId}`);
      console.log(`- Chromebooks: ${userQueue.chromebooks.length}`);
      console.log(`- Rooms: ${userQueue.rooms.length}`);

      const payload: any = {
        userEmail: userQueue.userEmail,
        userName: userQueue.userName,
      };

      if (hasChromebooks) {
        payload.chromebooks = userQueue.chromebooks;
      }

      if (hasRooms) {
        payload.rooms = userQueue.rooms;
      }

      const { error } = await supabase.functions.invoke('send-consolidated-booking-email', {
        body: payload,
      });

      if (error) {
        console.error('[BookingEmailQueue] Error sending email:', error);
      } else {
        console.log('[BookingEmailQueue] Email sent successfully');
      }
    } catch (error) {
      console.error('[BookingEmailQueue] Exception sending email:', error);
    } finally {
      this.cleanup(userId);
    }
  }

  private cleanup(userId: string): void {
    console.log(`[BookingEmailQueue] Cleaning up queue for user ${userId}`);
    this.queue.delete(userId);
    
    const timer = this.timers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(userId);
    }
  }

  // For debugging/testing
  getQueueStatus(userId: string): UserQueue | undefined {
    return this.queue.get(userId);
  }

  // Force send immediately (for testing or manual trigger)
  forceFlush(userId: string): void {
    const timer = this.timers.get(userId);
    if (timer) {
      clearTimeout(timer);
    }
    this.sendConsolidatedEmail(userId);
  }
}

// Export singleton instance
export const bookingEmailQueue = new BookingEmailQueue();
