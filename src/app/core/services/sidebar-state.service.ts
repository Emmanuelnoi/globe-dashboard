import { Injectable, signal } from '@angular/core';

/**
 * Sidebar State Service
 * Manages the sidebar collapsed/expanded state for use across components
 */
@Injectable({
  providedIn: 'root',
})
export class SidebarStateService {
  // Private signal for internal state management
  private readonly _isCollapsed = signal(false);

  // Public readonly signal for components to subscribe to
  readonly isCollapsed = this._isCollapsed.asReadonly();

  /**
   * Set the sidebar collapsed state
   */
  setCollapsed(collapsed: boolean): void {
    this._isCollapsed.set(collapsed);
  }

  /**
   * Toggle the sidebar collapsed state
   */
  toggleCollapsed(): void {
    this._isCollapsed.update((current) => !current);
  }
}
