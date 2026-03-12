import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

export interface Denomination {
  value: number;
  label: string;
  type: 'bill' | 'coin';
}

export interface ChangeItem {
  denom: Denomination;
  count: number;
}

const DENOMINATIONS: Denomination[] = [
  { value: 1000, label: '₱1,000', type: 'bill' },
  { value: 500,  label: '₱500',   type: 'bill' },
  { value: 200,  label: '₱200',   type: 'bill' },
  { value: 100,  label: '₱100',   type: 'bill' },
  { value: 50,   label: '₱50',    type: 'bill' },
  { value: 20,   label: '₱20',    type: 'bill' },
  { value: 10,   label: '₱10',    type: 'coin' },
  { value: 5,    label: '₱5',     type: 'coin' },
  { value: 1,    label: '₱1',     type: 'coin' },
];

@Component({
  selector: 'app-tamang-sukli',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './tamang-sukli.component.html',
  styleUrl: './tamang-sukli.component.css',
})
export class TamangSukliComponent {
  fareInput: number = 0;
  fare = signal(0);

  readonly commonFares = [35, 50, 65, 80, 95, 110, 125, 140];

  changeItems = computed<ChangeItem[]>(() => {
    let remaining = this.fare();
    const result: ChangeItem[] = [];
    for (const denom of DENOMINATIONS) {
      const count = Math.floor(remaining / denom.value);
      if (count > 0) result.push({ denom, count });
      remaining %= denom.value;
    }
    return result;
  });

  bills = computed(() => this.changeItems().filter(i => i.denom.type === 'bill'));
  coins = computed(() => this.changeItems().filter(i => i.denom.type === 'coin'));

  onFareInput(val: number): void {
    this.fare.set(Math.max(0, Math.round(val || 0)));
  }

  setFare(val: number): void {
    this.fareInput = val;
    this.fare.set(val);
  }
}
