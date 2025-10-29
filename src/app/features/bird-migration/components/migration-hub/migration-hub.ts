import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MigrationStateService } from '../../services/migration-state.service';
import { LoggerService } from '../../../../core/services/logger.service';
import type { MigrationRecord, Species } from '../../models/migration.types';
import { firstValueFrom } from 'rxjs';

/**
 * Main Bird Migration Hub Component
 * Serves as the central coordinator for all bird migration features
 */
@Component({
  selector: 'app-migration-hub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './migration-hub.component.html',
  styleUrl: './migration-hub.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MigrationHubComponent implements OnInit {
  // Injected services
  private readonly migrationState = inject(MigrationStateService);
  private readonly logger = inject(LoggerService);
  private readonly http = inject(HttpClient);

  // Component state signals
  private readonly _isCollapsed = signal<boolean>(false);
  private readonly _dataLoaded = signal<boolean>(false);

  // Public readonly signals
  readonly isCollapsed = this._isCollapsed.asReadonly();
  readonly dataLoaded = this._dataLoaded.asReadonly();
  readonly isLoading = this.migrationState.isLoading;
  readonly species = this.migrationState.species;

  // Lifecycle hooks
  async ngOnInit(): Promise<void> {
    await this.loadMigrationData();
  }

  // Event handlers
  toggleCollapse(): void {
    this._isCollapsed.update((collapsed) => !collapsed);
  }

  /**
   * Load migration data from JSON file
   */
  private async loadMigrationData(): Promise<void> {
    // Check if data is already loaded
    if (this.migrationState.species().length > 0) {
      this.logger.debug('✅ Migration data already loaded', 'MigrationHub');
      this._dataLoaded.set(true);
      return;
    }

    try {
      this.logger.debug('📦 Loading migration data...', 'MigrationHub');

      const data = await firstValueFrom(
        this.http.get<{ migrations: MigrationRecord[]; species: Species[] }>(
          '/assets/data/sample-migrations.json',
        ),
      );

      // Load data into state service
      this.migrationState.loadMigrationData(data.migrations, data.species);
      this._dataLoaded.set(true);

      // this.logger.success(
      //   `✅ Loaded ${data.migrations.length} migrations, ${data.species.length} species`,
      //   'MigrationHub',
      // );
    } catch (error) {
      this.logger.error(
        '❌ Failed to load migration data:',
        error,
        'MigrationHub',
      );
      this._dataLoaded.set(false);
    }
  }

  /**
   * Select a species by common name - finds migration and adds active path
   */
  selectSpecies(commonName: string): void {
    // Check if data is loaded
    if (!this._dataLoaded()) {
      this.logger.warn('⚠️ Migration data not loaded yet', 'MigrationHub');
      return;
    }

    this.logger.debug(`🐦 Species selected: ${commonName}`, 'MigrationHub');

    // Find species by common name
    const species = this.migrationState
      .species()
      .find((s) => s.commonName === commonName);

    if (!species) {
      this.logger.warn(`⚠️ Species not found: ${commonName}`, 'MigrationHub');
      return;
    }

    this.logger.debug(`✅ Found species:`, 'MigrationHub', species);

    // Find migration for this species
    const migration = this.migrationState
      .migrations()
      .find((m) => m.speciesId === species.id);

    if (!migration) {
      this.logger.warn(
        `⚠️ Migration not found for species: ${species.id}`,
        'MigrationHub',
      );
      return;
    }

    this.logger.debug(`✅ Found migration:`, 'MigrationHub', migration);

    // Add migration path (triggers visual hierarchy in state service)
    this.migrationState.addActivePath(migration.id);
    this.logger.debug(`🎯 Added active path: ${migration.id}`, 'MigrationHub');
  }
}
