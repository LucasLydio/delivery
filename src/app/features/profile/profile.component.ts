import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../core/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  readonly profile = inject(ProfileService);
  initials(): string {
    return this.profile.profile().name.split(/\s+/).slice(0, 2).map(value => value[0]).join('').toUpperCase();
  }
}
