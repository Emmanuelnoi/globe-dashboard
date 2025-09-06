import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Globe } from './pages/globe/globe';
import { Sidebar } from './pages/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Globe, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('global-dashboard');
}
