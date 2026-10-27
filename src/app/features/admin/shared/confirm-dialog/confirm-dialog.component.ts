import { Component, ElementRef, ViewChild, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  @ViewChild('dialog', { static: true })
  private readonly dialogRef!: ElementRef<HTMLDialogElement>;

  @ViewChild('cancelButton', { static: true })
  private readonly cancelButtonRef!: ElementRef<HTMLButtonElement>;

  protected readonly options = signal<ConfirmDialogOptions>({
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
  });

  private resolver: ((confirmed: boolean) => void) | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;

  request(options: ConfirmDialogOptions): Promise<boolean> {
    const dialog = this.dialogRef.nativeElement;

    if (dialog.open) {
      this.resolve(false);
    }

    this.options.set({ ...options, cancelLabel: options.cancelLabel ?? 'Cancelar' });

    const result = new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });

    if (!dialog.open) {
      this.previouslyFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    this.cancelButtonRef.nativeElement.focus();

    return result;
  }

  protected confirm(): void {
    this.close(true);
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    this.close(false);
  }

  protected handleBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) {
      this.close(false);
    }
  }

  protected handleNativeClose(): void {
    this.resolve(false);

    const elementToRestore = this.previouslyFocusedElement;
    this.previouslyFocusedElement = null;
    queueMicrotask(() => elementToRestore?.focus());
  }

  private close(confirmed: boolean): void {
    const dialog = this.dialogRef.nativeElement;
    this.resolve(confirmed);
    if (dialog.open) dialog.close(confirmed ? 'confirm' : 'cancel');
  }

  private resolve(confirmed: boolean): void {
    this.resolver?.(confirmed);
    this.resolver = null;
  }
}
