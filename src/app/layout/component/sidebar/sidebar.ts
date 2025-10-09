import {
  Component,
  computed,
  EventEmitter,
  inject,
  Output,
  signal,
  WritableSignal,
} from '@angular/core';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@lib/index';
import { TableKeyboardDirective } from '@lib/directives/table-keyboard.directive';
import { NavigationStateService } from '../../../core/services/navigation-state.service';
import { type ViewMode } from '../../../core/types/navigation.types';

interface Item {
  id: ViewMode;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent, TableKeyboardDirective], // Updated imports
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="sidebar"
      [class.collapsed]="collapsed()"
      aria-label="Primary navigation"
      [style.--icon-size.px]="iconSize()"
      [style.--pill-gap.px]="pillGap()"
    >
      <header class="sidebar-header">
        <button
          class="toggle"
          (click)="toggle()"
          [attr.aria-expanded]="!collapsed()"
          [attr.aria-pressed]="collapsed()"
          aria-label="Toggle navigation"
          type="button"
        >
          <app-icon name="menu" [size]="16"></app-icon>
        </button>

        @if (!collapsed()) {
          <div class="brand" aria-hidden="true"></div>
        }
      </header>

      <nav class="glass-card" role="navigation" aria-label="Main sidebar">
        <ul
          #menu
          class="menu"
          role="menu"
          tabindex="0"
          [appTableKeyboard]="items.length"
          [(focusedIndex)]="focusedIndexValue"
          (navigate)="focusItem($event)"
          (activate)="activate($event)"
          (pointerdown)="menu.focus()"
          [attr.aria-activedescendant]="'menuitem-' + focusedIndex()"
        >
          @for (item of items; let i = $index; track item.id) {
            <li
              class="menu-item"
              role="menuitem"
              id="menuitem-{{ i }}"
              tabindex="-1"
              [class.active]="item.id === selectedId()"
              [class.focused]="i === focusedIndex()"
              (click)="activate(i)"
              [attr.aria-current]="item.id === selectedId() ? 'page' : null"
              [attr.aria-label]="item.label"
            >
              @if (item.id === selectedId()) {
                <span class="active-pill" aria-hidden="true"></span>
              }

              <span class="icon" aria-hidden="true">
                <app-icon
                  [name]="item.icon"
                  [size]="iconSize()"
                  [variant]="collapsed() ? 'solid' : 'outline'"
                ></app-icon>
              </span>

              @if (!collapsed()) {
                <span class="label">{{ item.label }}</span>
              }
            </li>
          }
        </ul>
      </nav>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        /* design tokens (fallbacks) */
        --icon-size: 20px;
        --pill-gap: 12px;
        --sidebar-width: 320px;
        --sidebar-collapsed-width: 76px;

        font-family:
          Inter,
          system-ui,
          -apple-system,
          'Segoe UI',
          Roboto,
          'Helvetica Neue',
          Arial;
      }

      /* ---------------- layout ---------------- */
      .sidebar {
        position: fixed;
        top: 16px;
        left: 16px;
        width: var(--sidebar-width);
        z-index: 100;
        transition:
          width 220ms ease,
          transform 200ms ease;
        display: flex;
        flex-direction: column;
        padding: 16px;
        box-sizing: border-box;
      }
      .sidebar.collapsed {
        width: var(--sidebar-collapsed-width);
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        z-index: 6;
      }
      .toggle {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.06);
        padding: 8px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.95);
        /* TEMP DISABLED FOR DEBUG: backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px); */
      }
      .toggle:focus {
        outline: 2px solid rgba(255, 255, 255, 0.12);
        outline-offset: 3px;
      }
      .brand {
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      /* ---------------- glass card ---------------- */
      .glass-card {
        position: relative;
        overflow: visible;
        border-radius: 14px;
        padding: 18px;
        flex: 0 0 auto;
        /* TEMP DISABLED FOR DEBUG: backdrop-filter: blur(14px) saturate(1.25);
        -webkit-backdrop-filter: blur(14px) saturate(1.25); */
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.04);
        box-shadow:
          0 18px 40px rgba(0, 0, 0, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.02);
        z-index: 0;
      }

      .glass-card::after {
        content: '';
        position: absolute;
        top: -30%;
        left: -10%;
        width: 140%;
        height: 140%;
        background:
          radial-gradient(
            600px 300px at 20% 20%,
            rgba(255, 140, 210, 0.14),
            transparent 12%
          ),
          radial-gradient(
            500px 220px at 80% 80%,
            rgba(90, 120, 255, 0.12),
            transparent 10%
          );
        filter: blur(30px);
        pointer-events: none;
        z-index: 0;
      }

      /* ---------------- menu & items ---------------- */
      .menu {
        position: relative;
        list-style: none;
        padding: 6px;
        margin: 0;
        z-index: 5;
        overflow: visible;
      }

      .menu-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px;
        margin-bottom: 10px;
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.92);
        cursor: pointer;
        transition:
          transform 0.16s ease,
          color 0.16s ease;
        user-select: none;

        z-index: 10;
        overflow: visible;
      }

      /* default icon container (expanded) - static so pill fills the row */
      .menu-item .icon {
        position: static;
        width: var(--icon-size);
        height: var(--icon-size);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 0;
        filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.35));
      }

      .menu-item .icon app-icon,
      .menu-item .icon app-icon lucide-icon,
      .menu-item .icon app-icon svg {
        width: 100% !important;
        height: 100% !important;
        display: block !important;
        overflow: visible;
      }

      .menu-item .label {
        font-size: 15px;
      }
      .menu-item:hover {
        transform: translateY(-2px);
        color: #fff;
      }

      .menu-item:focus {
        outline: none;
        z-index: 12;
      }
      .menu-item:focus-visible {
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06);
        transform: translateY(-2px);
      }

      /* Complete override for all states in collapsed mode */
      .sidebar.collapsed .menu-item,
      .sidebar.collapsed .menu-item:hover,
      .sidebar.collapsed .menu-item:focus,
      .sidebar.collapsed .menu-item:focus-visible,
      .sidebar.collapsed .menu-item:active,
      .sidebar.collapsed .menu-item.focused,
      .sidebar.collapsed .menu-item.active {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
        transform: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      /* Override hover transform for collapsed mode */
      .sidebar.collapsed .menu-item:hover {
        transform: none !important;
      }

      /* Remove any outline from child elements in collapsed mode */
      .sidebar.collapsed .menu-item *,
      .sidebar.collapsed .menu-item *:hover,
      .sidebar.collapsed .menu-item *:focus,
      .sidebar.collapsed .menu-item *:focus-visible,
      .sidebar.collapsed .menu-item *:active {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      /* Prevent text selection on the entire collapsed menu */
      .sidebar.collapsed .menu {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      /* Nuclear option: prevent selection on EVERYTHING in collapsed sidebar */
      .sidebar.collapsed,
      .sidebar.collapsed * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
      }

      .menu-item.active {
        color: white;
      }

      /* Focus styles for expanded mode only */
      .sidebar:not(.collapsed) .menu-item.focused {
        outline: 1px solid rgba(156, 163, 175, 0.8);
        outline-offset: 2px;
        border-radius: 10px;
      }

      /* Only allow custom focus indicator for collapsed menu */
      .sidebar.collapsed .menu-item.focused {
        position: relative;
      }

      .sidebar.collapsed .menu-item.focused::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(var(--icon-size) + var(--pill-gap) + 8px);
        height: calc(var(--icon-size) + var(--pill-gap) + 8px);
        border: 1px solid rgba(156, 163, 175, 0.8);
        border-radius: 50%;
        pointer-events: none;
        z-index: 15;
      }

      /* default pill for expanded mode: inset inside the li */
      .sidebar:not(.collapsed) .menu-item .active-pill {
        position: absolute;
        left: 6px;
        right: 6px;
        top: 6px;
        bottom: 6px;
        border-radius: 10px;
        box-sizing: border-box;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow:
          0 8px 24px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
        /* TEMP DISABLED FOR DEBUG: backdrop-filter: blur(10px) saturate(1.15);
        -webkit-backdrop-filter: blur(10px) saturate(1.15); */
        pointer-events: none;
        overflow: hidden;
        z-index: 0;
      }

      /* collapse mode: make icon the positioning anchor and center a circular pill on that icon */
      .sidebar.collapsed .menu-item {
        padding: 12px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }

      .sidebar.collapsed .menu-item .icon {
        position: relative; /* icon becomes anchor for the pill in collapsed state */
        width: var(--icon-size);
        height: var(--icon-size);
        margin: 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }

      .sidebar.collapsed .menu-item .active-pill {
        position: absolute; /* anchored to .icon */
        top: 50%;
        left: 90%;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
        width: calc(var(--icon-size) + var(--pill-gap));
        height: calc(var(--icon-size) + var(--pill-gap));
        border-radius: 50%;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow:
          0 8px 20px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
        pointer-events: none;
        overflow: hidden;
        z-index: 8;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      /* sheen + sparkle */
      .active-pill::before {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-120%) rotate(-8deg);
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.28) 45%,
          rgba(255, 255, 255, 0.06)
        );
        filter: blur(12px);
        animation: sheen 2500ms linear infinite;
        mix-blend-mode: overlay;
        opacity: 0.9;
        pointer-events: none;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      .active-pill::after {
        content: '';
        position: absolute;
        right: 10px;
        top: 8px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(
          circle at 35% 35%,
          rgba(255, 255, 255, 0.9),
          rgba(255, 255, 255, 0.6) 30%,
          rgba(255, 255, 255, 0.12)
        );
        box-shadow: 0 6px 18px rgba(100, 110, 255, 0.25);
        animation: float 2800ms ease-in-out infinite;
        pointer-events: none;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }

      @keyframes sheen {
        to {
          transform: translateX(140%) rotate(-8deg);
        }
      }
      @keyframes float {
        0% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-6px);
        }
        100% {
          transform: translateY(0);
        }
      }

      /* stacking-safety: ensure icon + label always draw above pill */
      .menu-item .icon,
      .menu-item .label {
        position: relative;
        z-index: 11;
      }

      /* responsive: full-width collapse on small screens */
      @media (max-width: 720px) {
        .sidebar {
          position: fixed;
          left: 16px;
          top: 16px;
          bottom: 16px;
          z-index: 80;
        }
      }

      /* reduce motion */
      @media (prefers-reduced-motion: reduce) {
        .active-pill::before,
        .active-pill::after {
          animation: none;
        }
        .menu-item,
        .active-pill {
          transition: none;
        }
      }
    `,
  ],
})
export class Sidebar implements AfterViewInit {
  private cdr = inject(ChangeDetectorRef);
  private hostRef = inject(ElementRef<HTMLElement>);
  private navigationService = inject(NavigationStateService);

  /** navigation items from service */
  items: Item[] = this.navigationService.navigationItems;

  // --- Signals (reactive state) ---
  selectedId = computed(() => this.navigationService.currentView());
  collapsed: WritableSignal<boolean> = signal(false);
  focusedIndex: WritableSignal<number> = signal(0);

  public get focusedIndexValue(): number {
    return this.focusedIndex();
  }
  public set focusedIndexValue(v: number) {
    this.focusedIndex.set(v);
  }

  iconSize: WritableSignal<number> = signal(20);
  pillGap: WritableSignal<number> = signal(12);

  // derived computed value (example)
  selectedIndex = computed(() =>
    this.items.findIndex((i) => i.id === this.selectedId()),
  );

  // output emitter (still normal EventEmitter)
  @Output() selectedChange = new EventEmitter<string>();

  // DOM refs (imperative for focus)
  @ViewChild('menu', { static: true }) menuRef!: ElementRef<HTMLUListElement>;
  @ViewChildren('menuItemEl', { read: ElementRef }) menuItems!: QueryList<
    ElementRef<HTMLLIElement>
  >;

  ngAfterViewInit(): void {
    // set initial focusedIndex from selectedId
    const idx = this.selectedIndex();
    this.focusedIndex.set(idx >= 0 ? idx : 0);
  }

  // --- actions: update signals ---
  toggle(): void {
    this.collapsed.update((v) => !v);

    // when expanding, restore focus after DOM updates:
    if (!this.collapsed()) {
      queueMicrotask(() => this.menuRef?.nativeElement?.focus());
    }
  }

  public activate(index: number): void {
    const it = this.items[index];
    if (!it) return;

    // Navigate to the selected view using the service
    this.navigationService.navigateTo(it.id);
    this.focusedIndex.set(index);
    this.selectedChange.emit(it.id);

    // keep focus on activated item
    queueMicrotask(() => this.focusItem(index));
  }

  onItemFocus(index: number): void {
    this.focusedIndex.set(index);
  }

  public focusItem(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    this.focusedIndex.set(index);
  }

  trackById(_i: number, it: Item): string {
    return it.id;
  }
}
