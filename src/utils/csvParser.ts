import Papa from 'papaparse';
import { DeGiroTransaction, AccountActivity } from '@/types/transaction';

export const parseDeGiroCSV = (file: File): Promise<DeGiroTransaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions: DeGiroTransaction[] = results.data.map((row: any) => {
            const parseNumber = (value: string) => {
              if (!value || value.trim() === '') return 0;
              return parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));
            };

            return {
              datum: row.Datum || '',
              tijd: row.Tijd || '',
              product: row.Product || '',
              isin: row.ISIN || '',
              beurs: row.Beurs || '',
              uitvoeringsplaats: row.Uitvoeringsplaa || row.Uitvoeringsplaats || '',
              aantal: parseNumber(row.Aantal),
              koers: parseNumber(row.Koers),
              koersCurrency: row[''] || 'EUR',
              lokaleWaarde: parseNumber(row['Lokale waarde']),
              lokaleWaardeCurrency: row[' '] || 'EUR',
              waarde: parseNumber(row.Waarde),
              waardeCurrency: row['  '] || 'EUR',
              wisselkoers: parseNumber(row.Wisselkoers) || 1,
              transactiekosten: parseNumber(row['Transactiekosten en/of']),
              transactiekostenCurrency: row['   '] || 'EUR',
              totaal: parseNumber(row.Totaal),
              totaalCurrency: row['    '] || 'EUR',
              orderId: row['Order ID'] || '',
            };
          });

          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const parseAccountActivityCSV = (file: File): Promise<AccountActivity[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const activities: AccountActivity[] = results.data.map((row: any) => {
            const parseNumber = (value: string) => {
              if (!value || value.trim() === '') return 0;
              return parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));
            };

            return {
              datum: row.Datum || row.tum || '',
              tijd: row.Tijd || '',
              valutadatum: row.Valutadatum || '',
              product: row.Product || '',
              isin: row.ISIN || '',
              omschrijving: row.Omschrijving || '',
              fx: row.FX || '',
              mutatie: parseNumber(row.Mutatie),
              mutatieCurrency: row[''] || 'EUR',
              saldo: parseNumber(row.Saldo),
              saldoCurrency: row[' '] || 'EUR',
              orderId: row['Order Id'] || '',
            };
          });

          resolve(activities);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};
