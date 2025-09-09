import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Globe } from './pages/globe/globe';
import { Sidebar } from './layout/component/sidebar/sidebar';
import { ComparisonCard } from './layout/component/comparison-card/comparison-card';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Globe, Sidebar, ComparisonCard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('global-dashboard');
}
