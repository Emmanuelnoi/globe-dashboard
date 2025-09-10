import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <span
      class="icon"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.font-size.px]="size * 0.8"
      [class.solid]="variant === 'solid'"
      role="img"
      [attr.aria-label]="ariaLabel || name"
      [attr.aria-hidden]="ariaLabel ? null : 'true'"
      >{{ getIconText() }}</span
    >
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }
      .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: currentColor;
        font-family: monospace;
        font-weight: bold;
      }
    `,
  ],
})
export class IconComponent {
  @Input({ required: true }) name!: string;
  @Input() size = 20;
  @Input() ariaLabel?: string;
  @Input() variant: 'outline' | 'solid' = 'outline';

  getIconText(): string {
    const iconMap: Record<string, string> = {
      globe: '🌍',
      gamepad: '🎮',
      plane: '🐦',
      map: '🗺️',
      menu: '☰',
    };
    return iconMap[this.name] || '■';
  }
}
