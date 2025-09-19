import { Injectable, signal } from '@angular/core';
import { Vector2, Vector3, Raycaster, Camera, Group, Object3D } from 'three';
import { CountryIdTextureService } from '@lib/services/country-id-texture.service';

/**
 * Selection gesture types
 */
export type SelectionGesture =
  | 'click' // Replace selection
  | 'shift-click' // Add to selection
  | 'ctrl-click' // Toggle selection
  | 'escape'; // Clear selection;

/**
 * Selection event data
 */
export interface CountrySelectionEvent {
  countryId: string;
  countryName: string;
  gesture: SelectionGesture;
  position: { x: number; y: number };
  timestamp: number;
}

/**
 * Batch selection update
 */
export interface SelectionUpdate {
  countryId: string;
  selected: boolean;
  reason: 'user-click' | 'batch-operation' | 'programmatic';
}

/**
 * Service for handling country selection logic and gestures
 */
@Injectable({
  providedIn: 'root',
})
export class CountrySelectionService {
  // Selection state
  public readonly selectedCountries = signal<Set<string>>(new Set());
  public readonly lastSelectedCountry = signal<string | null>(null);
  public readonly selectionHistory = signal<string[]>([]);

  // Performance settings
  private readonly maxSelectionHistory = 50;
  private readonly batchUpdateThrottleMs = 16; // ~60fps

  // Raycasting
  private readonly raycaster = new Raycaster();
  private readonly mouse = new Vector3();

  // Batch update handling
  private pendingUpdates: SelectionUpdate[] = [];
  private batchUpdateTimeout?: number;

  constructor(private countryIdTextureService: CountryIdTextureService) {}

  /**
   * Handle mouse/touch selection events
   */
  handleSelectionGesture(
    event: MouseEvent | TouchEvent,
    camera: Camera,
    countriesGroup: Group,
    canvas: HTMLCanvasElement,
  ): CountrySelectionEvent | null {
    try {
      // Get normalized device coordinates
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if (event instanceof MouseEvent) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        // Touch event
        const touch = event.touches[0] || event.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      }

      const mouse = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
      };

      // Perform raycast to find intersected country
      const countryId = this.raycastCountry(mouse, camera, countriesGroup);

      if (!countryId) {
        return null;
      }

      // Determine gesture type
      const gesture = this.determineGesture(event);

      // Apply selection based on gesture
      const selectionEvent: CountrySelectionEvent = {
        countryId,
        countryName: this.getCountryName(countryId),
        gesture,
        position: { x: clientX, y: clientY },
        timestamp: Date.now(),
      };

      this.applySelectionGesture(selectionEvent);

      return selectionEvent;
    } catch (error) {
      console.warn('Selection gesture failed:', error);
      return null;
    }
  }

  /**
   * Programmatically select countries
   */
  selectCountries(countryIds: string[], replace = true): void {
    const updates: SelectionUpdate[] = [];

    if (replace) {
      // Clear existing selections
      for (const existingId of this.selectedCountries()) {
        if (!countryIds.includes(existingId)) {
          updates.push({
            countryId: existingId,
            selected: false,
            reason: 'programmatic',
          });
        }
      }
    }

    // Add new selections
    for (const countryId of countryIds) {
      if (!this.selectedCountries().has(countryId)) {
        updates.push({
          countryId,
          selected: true,
          reason: 'programmatic',
        });
      }
    }

    this.batchUpdateSelection(updates);
  }

  /**
   * Toggle country selection
   */
  toggleCountrySelection(countryId: string): void {
    const isSelected = this.selectedCountries().has(countryId);

    this.batchUpdateSelection([
      {
        countryId,
        selected: !isSelected,
        reason: 'user-click',
      },
    ]);
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    const updates: SelectionUpdate[] = [];

    for (const countryId of this.selectedCountries()) {
      updates.push({
        countryId,
        selected: false,
        reason: 'programmatic',
      });
    }

    this.batchUpdateSelection(updates);
  }

  /**
   * Select countries by criteria
   */
  selectByRegion(region: string): void {
    const countryIds: string[] = [];

    // Get all countries in the region
    // This would use the country data service to filter by region
    // For now, this is a placeholder

    this.selectCountries(countryIds, true);
  }

  /**
   * Select countries by continent
   */
  selectByContinent(continent: string): void {
    const countryIds: string[] = [];

    // Get all countries in the continent
    // This would use the country data service to filter by continent

    this.selectCountries(countryIds, true);
  }

  /**
   * Get selection statistics
   */
  getSelectionStats(): {
    totalSelected: number;
    countries: string[];
    lastSelected: string | null;
    historyLength: number;
  } {
    const selected = this.selectedCountries();

    return {
      totalSelected: selected.size,
      countries: Array.from(selected),
      lastSelected: this.lastSelectedCountry(),
      historyLength: this.selectionHistory().length,
    };
  }

  /**
   * Export selection data
   */
  exportSelection(): {
    countries: Array<{
      id: string;
      name: string;
      data?: ReturnType<CountryIdTextureService['getCountryData']>;
    }>;
    timestamp: string;
    totalCount: number;
  } {
    const selected = this.selectedCountries();
    const countries = Array.from(selected).map((countryId) => ({
      id: countryId,
      name: this.getCountryName(countryId),
      data: this.countryIdTextureService.getCountryData(countryId),
    }));

    return {
      countries,
      timestamp: new Date().toISOString(),
      totalCount: countries.length,
    };
  }

  /**
   * Undo last selection action
   */
  undoSelection(): void {
    const history = this.selectionHistory();
    if (history.length >= 2) {
      // Remove last action and restore previous state
      const previousSelection = history[history.length - 2];
      // This would restore the previous selection state
      // Implementation depends on how history is stored
    }
  }

  private raycastCountry(
    mouse: { x: number; y: number },
    camera: Camera,
    countriesGroup: Group,
  ): string | null {
    const mouseVector = new Vector2(mouse.x, mouse.y);
    this.raycaster.setFromCamera(mouseVector, camera);

    // Intersect with country meshes
    const intersects = this.raycaster.intersectObjects(
      countriesGroup.children,
      true,
    );

    for (const intersect of intersects) {
      const countryObject = this.findCountryFromObject(intersect.object);
      if (countryObject?.userData?.['countryId']) {
        return countryObject.userData['countryId'] as string;
      }
    }

    return null;
  }

  private findCountryFromObject(object: Object3D): Object3D | null {
    let current: Object3D | null = object;

    while (current) {
      if (current.userData?.['countryId']) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  private determineGesture(event: MouseEvent | TouchEvent): SelectionGesture {
    if (event instanceof KeyboardEvent && event.key === 'Escape') {
      return 'escape';
    }

    if (event instanceof MouseEvent) {
      if (event.shiftKey) return 'shift-click';
      if (event.ctrlKey || event.metaKey) return 'ctrl-click';
    }

    return 'click';
  }

  private applySelectionGesture(event: CountrySelectionEvent): void {
    const currentSelection = new Set(this.selectedCountries());
    let updates: SelectionUpdate[] = [];

    switch (event.gesture) {
      case 'click':
        // Replace selection
        for (const countryId of currentSelection) {
          if (countryId !== event.countryId) {
            updates.push({
              countryId,
              selected: false,
              reason: 'user-click',
            });
          }
        }
        if (!currentSelection.has(event.countryId)) {
          updates.push({
            countryId: event.countryId,
            selected: true,
            reason: 'user-click',
          });
        }
        break;

      case 'shift-click':
        // Add to selection
        if (!currentSelection.has(event.countryId)) {
          updates.push({
            countryId: event.countryId,
            selected: true,
            reason: 'user-click',
          });
        }
        break;

      case 'ctrl-click':
        // Toggle selection
        updates.push({
          countryId: event.countryId,
          selected: !currentSelection.has(event.countryId),
          reason: 'user-click',
        });
        break;

      case 'escape':
        // Clear all selections
        for (const countryId of currentSelection) {
          updates.push({
            countryId,
            selected: false,
            reason: 'user-click',
          });
        }
        break;
    }

    this.batchUpdateSelection(updates);
    this.updateHistory(event.countryId);
  }

  private batchUpdateSelection(updates: SelectionUpdate[]): void {
    this.pendingUpdates.push(...updates);

    // Throttle updates for performance
    if (this.batchUpdateTimeout) {
      clearTimeout(this.batchUpdateTimeout);
    }

    this.batchUpdateTimeout = window.setTimeout(() => {
      this.flushPendingUpdates();
    }, this.batchUpdateThrottleMs);
  }

  private flushPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) return;

    const currentSelection = new Set(this.selectedCountries());

    // Apply all pending updates
    for (const update of this.pendingUpdates) {
      if (update.selected) {
        currentSelection.add(update.countryId);
      } else {
        currentSelection.delete(update.countryId);
      }
    }

    // Update state
    this.selectedCountries.set(currentSelection);

    // Update texture service
    this.countryIdTextureService.updateSelectionMask(currentSelection);

    // Clear pending updates
    this.pendingUpdates = [];
    this.batchUpdateTimeout = undefined;

    console.log(
      `🎯 Selection updated: ${currentSelection.size} countries selected`,
    );
  }

  private updateHistory(countryId: string): void {
    const history = [...this.selectionHistory()];
    history.push(countryId);

    // Limit history size
    if (history.length > this.maxSelectionHistory) {
      history.shift();
    }

    this.selectionHistory.set(history);
    this.lastSelectedCountry.set(countryId);
  }

  private getCountryName(countryId: string): string {
    const countryData = this.countryIdTextureService.getCountryData(countryId);
    return countryData?.name || countryId;
  }
}
