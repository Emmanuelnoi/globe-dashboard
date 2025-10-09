/**
 * Rate Limiter Utility
 * Implements token bucket algorithm for GBIF API rate limiting
 *
 * @module rate-limiter.util
 * @description Ensures compliance with GBIF API rate limits (200ms between requests)
 */

import { RateLimitConfig } from '../models/migration.types';

/**
 * Token bucket rate limiter
 * Implements smooth rate limiting with configurable burst capacity
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private readonly minInterval: number; // minimum milliseconds between requests

  /**
   * Creates a new rate limiter
   * @param config - Rate limit configuration
   */
  constructor(private readonly config: RateLimitConfig) {
    this.maxTokens = config.requestsPerMinute;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = config.requestsPerMinute / 60000; // tokens per ms
    this.minInterval = config.retryAfter;
  }

  /**
   * Attempts to acquire a token for making a request
   * @returns Promise that resolves when a token is available
   */
  async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    // Calculate wait time until next token is available
    const tokensNeeded = 1 - this.tokens;
    const waitTime = Math.ceil(tokensNeeded / this.refillRate);

    await this.delay(Math.max(waitTime, this.minInterval));

    // Refill and try again
    this.refillTokens();
    this.tokens -= 1;
  }

  /**
   * Refills tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Delays execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets current token count (for monitoring)
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }

  /**
   * Resets the rate limiter to full capacity
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Gets time until next token is available
   */
  getTimeUntilNextToken(): number {
    this.refillTokens();

    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }
}

/**
 * Creates a default GBIF rate limiter
 * GBIF recommends 200ms between requests, max 300 requests/minute
 */
export function createGBIFRateLimiter(): RateLimiter {
  const config: RateLimitConfig = {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    retryAfter: 200, // 200ms minimum between requests
    maxRetries: 3,
  };

  return new RateLimiter(config);
}

/**
 * Rate limit decorator for async functions
 * @param rateLimiter - Rate limiter instance
 */
export function rateLimit(rateLimiter: RateLimiter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends (...args: any[]) => Promise<any>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: any[]) {
      await rateLimiter.acquire();
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Batch request executor with rate limiting
 */
export class BatchExecutor<T, R> {
  private queue: Array<{
    request: T;
    resolve: (value: R) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;

  constructor(
    private readonly rateLimiter: RateLimiter,
    private readonly executor: (request: T) => Promise<R>,
    private readonly maxConcurrent: number = 1,
  ) {}

  /**
   * Adds a request to the batch queue
   */
  async execute(request: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Processes queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent);

      const promises = batch.map(async ({ request, resolve, reject }) => {
        try {
          await this.rateLimiter.acquire();
          const result = await this.executor(request);
          resolve(result);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Unknown error'));
        }
      });

      await Promise.all(promises);
    }

    this.processing = false;
  }

  /**
   * Gets current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Clears the queue
   */
  clear(): void {
    this.queue.forEach(({ reject }) => {
      reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}
