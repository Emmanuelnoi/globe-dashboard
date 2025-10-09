/**
 * Centralized Logging Service
 * Provides production-safe logging with different log levels
 */

import { Injectable } from '@angular/core';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private currentLevel: LogLevel = LogLevel.DEBUG; // Default to DEBUG, can be changed via setLogLevel
  private enabledModules: Set<string> = new Set();

  /**
   * Set the minimum log level that will be output
   */
  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Enable logging for specific modules only (useful for debugging)
   * @param modules Array of module names to enable logging for
   */
  enableModules(...modules: string[]): void {
    modules.forEach((module) => this.enabledModules.add(module));
  }

  /**
   * Disable logging for specific modules
   */
  disableModules(...modules: string[]): void {
    modules.forEach((module) => this.enabledModules.delete(module));
  }

  /**
   * Clear all module filters
   */
  clearModuleFilters(): void {
    this.enabledModules.clear();
  }

  /**
   * Debug level logging (development only)
   * Can be called with: debug(message), debug(message, module), or debug(message, module, data...)
   */
  debug(
    message: string,
    moduleOrData?: string | unknown,
    ...args: unknown[]
  ): void {
    // If second param is a string, treat it as module. Otherwise treat it as data.
    const module = typeof moduleOrData === 'string' ? moduleOrData : undefined;
    const data =
      typeof moduleOrData === 'string' ? args : [moduleOrData, ...args];

    if (this.shouldLog(LogLevel.DEBUG, module)) {
      const prefix = this.formatPrefix('DEBUG', module);
      console.log(prefix, message, ...data.filter((d) => d !== undefined));
    }
  }

  /**
   * Info level logging
   * Can be called with: info(message), info(message, module), or info(message, module, data...)
   */
  info(
    message: string,
    moduleOrData?: string | unknown,
    ...args: unknown[]
  ): void {
    // If second param is a string, treat it as module. Otherwise treat it as data.
    const module = typeof moduleOrData === 'string' ? moduleOrData : undefined;
    const data =
      typeof moduleOrData === 'string' ? args : [moduleOrData, ...args];

    if (this.shouldLog(LogLevel.INFO, module)) {
      const prefix = this.formatPrefix('INFO', module);
      console.info(prefix, message, ...data.filter((d) => d !== undefined));
    }
  }

  /**
   * Warning level logging
   * Can be called with: warn(message), warn(message, module), or warn(message, module, data...)
   */
  warn(
    message: string,
    moduleOrData?: string | unknown,
    ...args: unknown[]
  ): void {
    // If second param is a string, treat it as module. Otherwise treat it as data.
    const module = typeof moduleOrData === 'string' ? moduleOrData : undefined;
    const data =
      typeof moduleOrData === 'string' ? args : [moduleOrData, ...args];

    if (this.shouldLog(LogLevel.WARN, module)) {
      const prefix = this.formatPrefix('WARN', module);
      console.warn(prefix, message, ...data.filter((d) => d !== undefined));
    }
  }

  /**
   * Error level logging (always enabled)
   */
  error(message: string, error?: unknown, module?: string): void {
    if (this.shouldLog(LogLevel.ERROR, module)) {
      const prefix = this.formatPrefix('ERROR', module);
      if (error) {
        console.error(prefix, message, error);
      } else {
        console.error(prefix, message);
      }
    }
  }

  /**
   * Log a success message with visual indicator
   */
  success(message: string, module?: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO, module)) {
      const prefix = this.formatPrefix('✅ SUCCESS', module);
      console.log(prefix, message, ...args);
    }
  }

  /**
   * Group related log messages
   */
  group(label: string, module?: string): void {
    if (this.shouldLog(LogLevel.DEBUG, module)) {
      const prefix = this.formatPrefix('GROUP', module);
      console.group(prefix, label);
    }
  }

  /**
   * End a log group
   */
  groupEnd(): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * Log a table (useful for arrays of objects)
   */
  table(data: unknown, module?: string): void {
    if (this.shouldLog(LogLevel.DEBUG, module)) {
      const prefix = this.formatPrefix('TABLE', module);
      console.log(prefix);
      console.table(data);
    }
  }

  /**
   * Time a block of code execution
   */
  time(label: string, module?: string): void {
    if (this.shouldLog(LogLevel.DEBUG, module)) {
      const prefix = this.formatPrefix('TIME', module);
      console.time(`${prefix} ${label}`);
    }
  }

  /**
   * End timing a block of code
   */
  timeEnd(label: string, module?: string): void {
    if (this.shouldLog(LogLevel.DEBUG, module)) {
      const prefix = this.formatPrefix('TIME', module);
      console.timeEnd(`${prefix} ${label}`);
    }
  }

  /**
   * Check if a log should be output based on level and module filters
   */
  private shouldLog(level: LogLevel, module?: string): boolean {
    // Always allow errors
    if (level === LogLevel.ERROR) return true;

    // Check log level
    if (level < this.currentLevel) return false;

    // Check module filter
    if (this.enabledModules.size > 0 && module) {
      return this.enabledModules.has(module);
    }

    return true;
  }

  /**
   * Format the log prefix with timestamp and module info
   */
  private formatPrefix(level: string, module?: string): string {
    const timestamp = new Date().toISOString().substr(11, 8);
    const moduleStr = module ? `[${module}]` : '';
    return `[${timestamp}] [${level}]${moduleStr}`;
  }
}
