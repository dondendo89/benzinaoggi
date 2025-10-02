/**
 * Simple in-memory cache with TTL for BenzinaOggi API optimization
 * Safe implementation with fallback and feature flags
 */

interface CacheItem<T> {
  data: T;
  expires: number;
  created: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

export class SafeCache {
  private cache = new Map<string, CacheItem<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0
  };
  
  // Feature flag to disable cache if needed
  private enabled = process.env.CACHE_ENABLED !== 'false';
  
  // Max cache size to prevent memory issues
  private maxSize = parseInt(process.env.CACHE_MAX_SIZE || '1000');
  
  // Default TTL values (conservative start)
  static readonly TTL = {
    DISTRIBUTORS_LIST: 5 * 60 * 1000,     // 5 minutes (was 15)
    DISTRIBUTOR_DETAIL: 3 * 60 * 1000,   // 3 minutes (was 10)  
    PRICES_BY_CITY: 5 * 60 * 1000,       // 5 minutes
    NEARBY_SEARCH: 2 * 60 * 1000,        // 2 minutes (geographic queries)
  };

  set<T>(key: string, data: T, ttl: number): boolean {
    if (!this.enabled) return false;
    
    try {
      // Check max size limit
      if (this.cache.size >= this.maxSize) {
        this.cleanup();
        
        // If still at max after cleanup, don't cache
        if (this.cache.size >= this.maxSize) {
          console.warn('Cache at max size, skipping cache set for:', key);
          return false;
        }
      }
      
      this.cache.set(key, {
        data,
        expires: Date.now() + ttl,
        created: Date.now()
      });
      
      this.stats.sets++;
      this.stats.size = this.cache.size;
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  get<T>(key: string): T | null {
    if (!this.enabled) return null;
    
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        this.stats.misses++;
        return null;
      }
      
      // Check if expired
      if (Date.now() > item.expires) {
        this.cache.delete(key);
        this.stats.deletes++;
        this.stats.misses++;
        this.stats.size = this.cache.size;
        return null;
      }
      
      this.stats.hits++;
      return item.data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  delete(key: string): boolean {
    if (!this.enabled) return false;
    
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.stats.deletes++;
        this.stats.size = this.cache.size;
      }
      return deleted;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Bulk delete with pattern matching
  deletePattern(pattern: string): number {
    if (!this.enabled) return 0;
    
    let deleted = 0;
    try {
      const regex = new RegExp(pattern.replace('*', '.*'));
      
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          deleted++;
        }
      }
      
      this.stats.deletes += deleted;
      this.stats.size = this.cache.size;
      
      return deleted;
    } catch (error) {
      console.error('Cache deletePattern error:', error);
      return 0;
    }
  }

  // Clean up expired items
  cleanup(): number {
    if (!this.enabled) return 0;
    
    let cleaned = 0;
    const now = Date.now();
    
    try {
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expires) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      
      this.stats.deletes += cleaned;
      this.stats.size = this.cache.size;
      
      return cleaned;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  // Clear all cache (emergency function)
  clear(): void {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.stats.deletes += size;
      this.stats.size = 0;
      console.log('Cache cleared completely');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Get cache statistics
  getStats(): CacheStats & { hitRate: number; enabled: boolean } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      enabled: this.enabled
    };
  }

  // Enable/disable cache at runtime
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
    console.log(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Health check
  isHealthy(): boolean {
    try {
      // Test basic operations
      const testKey = '_health_check_';
      this.set(testKey, 'test', 1000);
      const retrieved = this.get(testKey);
      this.delete(testKey);
      
      return retrieved === 'test';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
}

// Global cache instance
export const cache = new SafeCache();

// Helper function to generate cache keys
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  // Sort params for consistent keys
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  
  return `${prefix}:${sortedParams}`;
}

// Cache decorator for API routes
export function withCache<T>(
  keyGenerator: (req: any) => string,
  ttl: number,
  options: {
    skipCondition?: (req: any) => boolean;
    transform?: (data: T) => T;
  } = {}
) {
  return function(handler: (req: any) => Promise<T>) {
    return async function(req: any): Promise<T> {
      // Skip cache if condition met
      if (options.skipCondition?.(req)) {
        console.log('Cache skipped due to skip condition');
        return handler(req);
      }
      
      const cacheKey = keyGenerator(req);
      
      // Try to get from cache
      const cached = cache.get<T>(cacheKey);
      if (cached) {
        console.log(`Cache HIT: ${cacheKey}`);
        return options.transform ? options.transform(cached) : cached;
      }
      
      console.log(`Cache MISS: ${cacheKey}`);
      
      // Get fresh data
      const result = await handler(req);
      
      // Cache the result
      const success = cache.set(cacheKey, result, ttl);
      if (!success) {
        console.warn(`Failed to cache result for: ${cacheKey}`);
      }
      
      return options.transform ? options.transform(result) : result;
    };
  };
}

// Automatic cleanup every 5 minutes
setInterval(() => {
  try {
    const cleaned = cache.cleanup();
    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired items`);
    }
  } catch (error) {
    console.error('Scheduled cache cleanup failed:', error);
  }
}, 5 * 60 * 1000);

// Log cache stats every 30 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('Cache Stats:', cache.getStats());
  }, 30 * 60 * 1000);
}
