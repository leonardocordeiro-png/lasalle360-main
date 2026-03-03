import { useState, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export function useCache<T>(ttl: number = 5 * 60 * 1000) { // 5 minutos default
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

  const get = useCallback((key: string): T | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cacheRef.current.delete(key);
      return null;
    }
    
    return entry.data;
  }, []);

  const set = useCallback((key: string, data: T, customTtl?: number) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl || ttl,
    });
  }, [ttl]);

  const clear = useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  const size = useCallback(() => {
    return cacheRef.current.size;
  }, []);

  return { get, set, clear, size };
}

export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => func(...args), delay);
  }, [func, delay]);
}

export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  const inThrottle = useRef(false);
  
  return useCallback((...args: Parameters<T>) => {
    if (!inThrottle.current) {
      func(...args);
      inThrottle.current = true;
      setTimeout(() => (inThrottle.current = false), limit);
    }
  }, [func, limit]);
}
