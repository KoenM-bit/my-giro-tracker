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

            // Get all keys to find the currency columns (they have empty names)
            const keys = Object.keys(row);
            const emptyKeys = keys.filter(k => k === '' || k.startsWith('__parsed_extra'));
            
            return {
              datum: row.Datum || row.tum || '',
              tijd: row.Tijd || '',
              valutadatum: row.Valutadatum || '',
              product: row.Product || '',
              isin: row.ISIN || '',
              omschrijving: row.Omschrijving || '',
              fx: row.FX || '',
              mutatie: parseNumber(row.Mutatie),
              mutatieCurrency: emptyKeys[0] ? row[emptyKeys[0]] || 'EUR' : 'EUR',
              saldo: parseNumber(row.Saldo),
              saldoCurrency: emptyKeys[1] ? row[emptyKeys[1]] || 'EUR' : 'EUR',
              orderId: row['Order Id'] || '',
            };
          });

          console.log('Parsed account activities:', activities.length, 'Sample:', activities[0]);
          resolve(activities);
        } catch (error) {
          console.error('Error parsing account activities:', error);
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};
