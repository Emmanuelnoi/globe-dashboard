import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <lucide-icon
      [name]="name"
      [size]="size"
      [attr.width]="size"
      [attr.height]="size"
      class="icon"
      [class.solid]="variant === 'solid'"
      role="img"
      [attr.aria-label]="ariaLabel || null"
      [attr.aria-hidden]="ariaLabel ? null : 'true'"
      focusable="false"
    ></lucide-icon>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }
      .icon {
        display: inline-block;
        vertical-align: middle;
        stroke: currentColor;
        fill: none;
        transition:
          fill 0.2,
          stroke 0.2;
      }
      /* Solid variant overrides stroke with fill */
      .icon.solid {
        stroke: none;
        fill: currentColor;
      }
    `,
  ],
})
export class IconComponent {
  @Input({ required: true }) name!: string;
  @Input() size = 20;
  @Input() ariaLabel?: string;
  @Input() variant: 'outline' | 'solid' = 'outline';
}
