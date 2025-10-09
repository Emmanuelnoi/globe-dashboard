/**
 * Migration Logger Utilities
 * Environment-aware logging for bird migration feature
 *
 * @module migration-logger.utils
 * @description Production-safe logging with automatic filtering
 */

/**
 * Logger configuration
 */
interface LoggerConfig {
  readonly enabled: boolean;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default logger configuration
 * Automatically disables debug/info logs in production
 */
const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  level: 'info', // Change to 'warn' in production build
};

/**
 * Migration feature logger
 */
class MigrationLogger {
  private config: LoggerConfig = DEFAULT_CONFIG;

  /**
   * Set logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Debug level logging (development only)
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    console.log(`🐛 ${message}`, ...args);
  }

  /**
   * Info level logging
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    console.log(`ℹ️ ${message}`, ...args);
  }

  /**
   * Warning level logging
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    console.warn(`⚠️ ${message}`, ...args);
  }

  /**
   * Error level logging (always enabled)
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`❌ ${message}`, ...args);
  }

  /**
   * Success logging (info level)
   */
  success(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    console.log(`✅ ${message}`, ...args);
  }

  /**
   * Check if logging should occur based on level
   */
  private shouldLog(level: LoggerConfig['level']): boolean {
    if (!this.config.enabled) return false;

    const levels: LoggerConfig['level'][] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.config.level);
    const messageIndex = levels.indexOf(level);

    return messageIndex >= currentIndex;
  }
}

/**
 * Singleton logger instance
 */
export const migrationLogger = new MigrationLogger();

/**
 * Configure logger for production
 * Call this in app initialization for production builds
 */
export function configureProductionLogging(): void {
  migrationLogger.configure({
    enabled: true,
    level: 'warn', // Only show warnings and errors
  });
}

/**
 * Disable all logging (for testing)
 */
export function disableLogging(): void {
  migrationLogger.configure({ enabled: false });
}
