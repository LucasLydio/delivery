import { Component, ElementRef, Input, signal, ViewChild } from '@angular/core';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-install-button',
  standalone: true,
  template: `
    @if (!installed()) {
      <button type="button" class="install-button" [class.install-button--compact]="compact" [attr.aria-label]="compact ? 'Install app' : null" (click)="install()">
        @if (compact) {
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
        } @else {
          <span aria-hidden="true">↧</span> Install app
        }
      </button>
    } @else {
      @if (!compact) { <span class="installed-badge">✓ Installed</span> }
    }
    <dialog #helpDialog class="install-help" aria-labelledby="install-title">
        <div class="install-help__panel">
          <button type="button" class="icon-button close-button" aria-label="Close install instructions" (click)="closeHelp()">×</button>
          <div class="install-help__icon" aria-hidden="true">↧</div>
          <h2 id="install-title">Put us on your home screen</h2>
          @if (isIos) {
            <p>In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Open the new icon to use the app and enable notifications.</p>
          } @else {
            <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Then open it from the new icon.</p>
          }
          <button type="button" class="button button--dark" (click)="closeHelp()">Got it</button>
        </div>
    </dialog>
  `,
  styles: [`
    .install-button { background: var(--color-dark); color: var(--bg-lighter); border-radius: 99px; padding: .7rem 1rem; font-size: .82rem; font-weight: 700; white-space: nowrap; }
    .install-button:hover { background: var(--color-medium); }
    .install-button--compact { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; padding: 0; background: transparent; color: var(--color-dark); }
    .install-button--compact:hover { background: var(--bg-light); }
    .install-button--compact svg { width: 1.35rem; height: 1.35rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .installed-badge { font-size: .8rem; font-weight: 700; color: var(--color-light); white-space: nowrap; }
    .install-help { width: min(calc(100% - 2rem), 24rem); max-height: calc(100% - 2rem); border: 0; border-radius: var(--radius-lg); padding: 0; background: var(--bg-lighter); color: var(--color-dark); box-shadow: var(--shadow-xlg); }
    .install-help::backdrop { background: rgb(17 24 39 / .5); }
    .install-help__panel { position: relative; padding: 2rem; }
    .install-help__panel h2 { font-size: 1.4rem; margin: .75rem 0; }
    .install-help__panel p { margin-bottom: 1.5rem; }
    .install-help__icon { display: grid; place-items: center; width: 3rem; height: 3rem; border-radius: 50%; background: var(--brand-lighter); color: var(--brand-medium); font-size: 1.8rem; }
    .close-button { position: absolute; top: 1rem; right: 1rem; }
  `],
})
export class InstallButtonComponent {
  @Input() compact = false;
  @ViewChild('helpDialog') private helpDialog?: ElementRef<HTMLDialogElement>;
  readonly installed = signal(this.isStandalone());
  readonly isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  private promptEvent?: InstallPromptEvent;

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.promptEvent = event as InstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => { this.installed.set(true); this.promptEvent = undefined; });
    document.addEventListener('visibilitychange', () => this.installed.set(this.isStandalone()));
  }

  async install(): Promise<void> {
    if (this.promptEvent) {
      const prompt = this.promptEvent;
      this.promptEvent = undefined;
      await prompt.prompt();
      await prompt.userChoice;
    } else {
      this.helpDialog?.nativeElement.showModal();
    }
  }

  closeHelp(): void {
    this.helpDialog?.nativeElement.close();
  }

  private isStandalone(): boolean {
    return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }
}
