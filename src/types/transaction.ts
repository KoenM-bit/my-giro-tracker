export interface DeGiroTransaction {
  datum: string;
  tijd: string;
  product: string;
  isin: string;
  beurs: string;
  uitvoeringsplaats: string;
  aantal: number;
  koers: number;
  koersCurrency: string;
  lokaleWaarde: number;
  lokaleWaardeCurrency: string;
  waarde: number;
  waardeCurrency: string;
  wisselkoers: number;
  transactiekosten: number;
  transactiekostenCurrency: string;
  totaal: number;
  totaalCurrency: string;
  orderId: string;
}

export interface PortfolioHolding {
  product: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercentage: number;
}

export interface PortfolioSnapshot {
  date: Date;
  value: number;
}

export interface AccountActivity {
  datum: string;
  tijd: string;
  valutadatum: string;
  product: string;
  isin: string;
  omschrijving: string;
  fx: string;
  mutatie: number;
  mutatieCurrency: string;
  saldo: number;
  saldoCurrency: string;
  orderId: string;
}
