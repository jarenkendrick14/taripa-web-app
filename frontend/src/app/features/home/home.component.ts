import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  auth = inject(AuthService);

  activities = [
    { type: 'report', location: 'Friendship Highway', time: '2 mins ago', icon: 'flag' },
    { type: 'verify', location: 'Balibago to Dau', time: '15 mins ago', icon: 'check-circle' },
    { type: 'alert', location: 'Hensonville', time: '1 hour ago', icon: 'alert-triangle' },
    { type: 'report', location: 'SM Clark Terminal', time: '2 hours ago', icon: 'flag' }
  ];

  faqs = [
    {
      q: 'What is Ordinance No. 723?',
      a: 'It is the official City Ordinance of Angeles City that defines the updated fare structure for tricycles, including base fares and additional kilometer rates.',
      open: false
    },
    {
      q: 'How is the fare calculated?',
      a: 'Fares are calculated based on the distance between your origin and destination. The app uses GPS to find the shortest legal route and applies the rates from Ordinance 723.',
      open: false
    },
    {
      q: 'What if a driver overcharges?',
      a: 'You can use the "Report" feature in this app. We compile these reports and submit them weekly to the PTRO (Public Transportation Regulatory Office) for enforcement.',
      open: false
    },
    {
      q: 'Can I use this app as proof of fare?',
      a: 'The app serves as an official reference based on Ordinance No. 723. While most drivers comply, you should use the digital receipt to start a polite conversation about the legal rate.',
      open: false
    }
  ];

  testimonials = [
    {
      quote: "Finally, a way to know the exact fare. No more guessing or overpaying.",
      author: "Maria S.",
      role: "Daily Commuter"
    },
    {
      quote: "The report feature actually works. This helps clean up our transportation system.",
      author: "James D.",
      role: "Student"
    },
    {
      quote: "GPS fare calculation is so accurate. It gives me peace of mind every ride.",
      author: "Liza T.",
      role: "Frequent Rider"
    }
  ];

  toggleFaq(index: number) {
    this.faqs[index].open = !this.faqs[index].open;
  }
}
