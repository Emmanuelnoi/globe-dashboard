import {
  Directive,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { isNavKey, nextIndex } from '../utils/keyboard.utils';

@Directive({
  selector: '[appTableKeyboard]',
  standalone: true,
})
export class TableKeyboardDirective {
  /** number of items in the list/table (required) */
  @Input('appTableKeyboard') length = 0;

  @Input() focusedIndex = 0;
  @Output() focusedIndexChange = new EventEmitter<number>();

  /** Emits when the user activates (Enter / Space) — payload is the current index */
  @Output() activate = new EventEmitter<number>();

  /** Emits on any navigation change (new index) */
  @Output() navigate = new EventEmitter<number>();

  /** Intercept keyboard events on host */
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!isNavKey(key)) return;

    // Prevent default browser scrolling for handled keys
    event.preventDefault();
    event.stopImmediatePropagation();

    // handle Enter/Space activation
    if (key === 'Enter' || key === ' ') {
      this.activate.emit(this.focusedIndex);
      return;
    }

    // compute next index (wrap-around behavior)
    const next = nextIndex(this.focusedIndex, key, this.length);
    if (next !== this.focusedIndex && next >= 0) {
      this.focusedIndex = next;
      this.focusedIndexChange.emit(next);
      this.navigate.emit(next);
    }
  }
}
