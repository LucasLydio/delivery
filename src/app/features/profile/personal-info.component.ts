import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../core/profile.service';

@Component({
  selector: 'app-personal-info',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './personal-info.component.html',
  styleUrl: './personal-info.component.css',
})
export class PersonalInfoComponent {
  private readonly builder = inject(FormBuilder);
  readonly profile = inject(ProfileService);
  readonly saved = signal(false);
  readonly form = this.builder.nonNullable.group({
    name: [this.profile.profile().name, [Validators.required, Validators.maxLength(80)]],
    email: [this.profile.profile().email, [Validators.required, Validators.email]],
    phone: [this.profile.profile().phone, [Validators.required, Validators.maxLength(30)]],
    address: [this.profile.profile().address, [Validators.required, Validators.maxLength(160)]],
    bio: [this.profile.profile().bio, [Validators.maxLength(240)]],
  });

  initials(): string {
    return this.form.controls.name.value.split(/\s+/).slice(0, 2).map(value => value[0]).join('').toUpperCase();
  }

  save(): void {
    this.saved.set(false);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.profile.update(this.form.getRawValue());
    this.saved.set(true);
    this.form.markAsPristine();
  }
}
