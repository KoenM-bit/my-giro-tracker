import { DeGiroTransaction, PortfolioHolding, PortfolioSnapshot, AccountActivity } from '@/types/transaction';
import { parse, format } from 'date-fns';

export const calculateHoldings = (transactions: DeGiroTransaction[]): PortfolioHolding[] => {
  const holdingsMap = new Map<string, PortfolioHolding>();

  transactions.forEach((transaction) => {
    const key = `${transaction.isin}-${transaction.product}`;
    const existing = holdingsMap.get(key);

    if (existing) {
      const newQuantity = existing.quantity + transaction.aantal;
      const newTotalCost = existing.totalCost + Math.abs(transaction.waarde);
      
      holdingsMap.set(key, {
        ...existing,
        quantity: newQuantity,
        totalCost: newTotalCost,
        averagePrice: newQuantity !== 0 ? newTotalCost / Math.abs(newQuantity) : 0,
      });
    } else {
      holdingsMap.set(key, {
        product: transaction.product,
        isin: transaction.isin,
        quantity: transaction.aantal,
        averagePrice: Math.abs(transaction.koers),
        totalValue: 0,
        totalCost: Math.abs(transaction.waarde),
        profitLoss: 0,
        profitLossPercentage: 0,
      });
    }
  });

  return Array.from(holdingsMap.values()).filter(h => h.quantity !== 0);
};

export const calculatePortfolioValue = (transactions: DeGiroTransaction[]): number => {
  return transactions.reduce((sum, t) => sum + t.waarde, 0);
};

export const calculatePortfolioOverTime = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = []
): PortfolioSnapshot[] => {
  // Track holdings to identify when positions are closed and realize P/L
  const holdingsMap = new Map<string, { totalCost: number; quantity: number }>();
  const snapshots: PortfolioSnapshot[] = [];
  let portfolioValue = 0; // Track deposits + realized P/L only
  
  // Combine all events
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit'; data: any }> = [];
  
  transactions.forEach((transaction) => {
    const date = parse(`${transaction.datum} ${transaction.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'transaction', data: transaction });
    }
  });
  
  accountActivities.forEach((activity) => {
    const date = parse(`${activity.datum} ${activity.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime()) && activity.omschrijving.toLowerCase().includes('ideal')) {
      allEvents.push({ date, type: 'deposit', data: activity });
    }
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  allEvents.forEach((event) => {
    if (event.type === 'deposit') {
      // Deposits add to portfolio value
      portfolioValue += event.data.mutatie;
    } else {
      // Transaction - only affects portfolio value when position closes (realizes P/L)
      const transaction = event.data as DeGiroTransaction;
      const key = `${transaction.isin}-${transaction.product}`;
      const existing = holdingsMap.get(key);
      
      if (existing) {
        const newQuantity = existing.quantity + transaction.aantal;
        const transactionCost = Math.abs(transaction.waarde);
        
        if (newQuantity === 0) {
          // Position fully closed - realize P/L
          // Realized P/L = what we got out - what we put in
          const realizedPL = existing.totalCost + transaction.waarde;
          portfolioValue += realizedPL;
          holdingsMap.delete(key);
        } else if (Math.sign(existing.quantity) !== Math.sign(newQuantity) && newQuantity !== 0) {
          // Partial close - realize P/L on closed portion
          const closedQuantity = Math.abs(existing.quantity) > Math.abs(transaction.aantal) 
            ? Math.abs(transaction.aantal) 
            : Math.abs(existing.quantity);
          const avgCost = existing.totalCost / Math.abs(existing.quantity);
          const closedCost = -avgCost * closedQuantity;
          const closedSale = (transaction.waarde / Math.abs(transaction.aantal)) * closedQuantity;
          const realizedPL = closedCost + closedSale;
          portfolioValue += realizedPL;
          
          // Update remaining position
          const remainingQuantity = existing.quantity + transaction.aantal;
          const remainingCost = existing.totalCost - closedCost;
          holdingsMap.set(key, {
            totalCost: remainingCost,
            quantity: remainingQuantity,
          });
        } else {
          // Adding to position - no realized P/L
          holdingsMap.set(key, {
            totalCost: existing.totalCost + transaction.waarde,
            quantity: newQuantity,
          });
        }
      } else {
        // New position - no realized P/L
        holdingsMap.set(key, {
          totalCost: transaction.waarde,
          quantity: transaction.aantal,
        });
      }
    }
    
    snapshots.push({
      date: event.date,
      value: portfolioValue,
    });
  });
  
  return snapshots;
};

export const calculateTotalCosts = (transactions: DeGiroTransaction[]): number => {
  return transactions.reduce((sum, t) => sum + Math.abs(t.transactiekosten), 0);
};

export const isOptionTransaction = (transaction: DeGiroTransaction): boolean => {
  // Options have pattern Cxx or Pxx where xx is at least 2 digits
  const optionPattern = /[CP]\d{2,}/;
  return optionPattern.test(transaction.product);
};

export const calculateProfitLoss = (transactions: DeGiroTransaction[]): number => {
  const netCashFlow = transactions.reduce((sum, t) => sum + t.waarde, 0);
  const totalCosts = calculateTotalCosts(transactions);
  return netCashFlow - totalCosts;
};

export const calculateProfitLossByType = (
  transactions: DeGiroTransaction[],
  holdings: PortfolioHolding[]
): {
  optionsPL: number;
  stocksPL: number;
  portfolioValue: number;
  totalPL: number;
  optionsRealized: number;
  optionsUnrealized: number;
  stocksRealized: number;
  stocksUnrealized: number;
} => {
  // Build holdings map to identify closed vs open positions
  const holdingsMap = new Map<string, { netCashFlow: number; quantity: number; isOption: boolean }>();
  
  transactions.forEach((transaction) => {
    const key = `${transaction.isin}-${transaction.product}`;
    const isOption = isOptionTransaction(transaction);
    const existing = holdingsMap.get(key);
    
    if (existing) {
      holdingsMap.set(key, {
        netCashFlow: existing.netCashFlow + transaction.waarde,
        quantity: existing.quantity + transaction.aantal,
        isOption: existing.isOption,
      });
    } else {
      holdingsMap.set(key, {
        netCashFlow: transaction.waarde,
        quantity: transaction.aantal,
        isOption,
      });
    }
  });
  
  // Separate realized (closed positions) from unrealized (open positions)
  let optionsRealized = 0;
  let optionsUnrealized = 0;
  let stocksRealized = 0;
  let stocksUnrealized = 0;
  
  holdingsMap.forEach((holding, key) => {
    if (holding.quantity === 0) {
      // Closed position = realized P/L (net cash flow)
      if (holding.isOption) {
        optionsRealized += holding.netCashFlow;
      } else {
        stocksRealized += holding.netCashFlow;
      }
    } else {
      // Open position - calculate unrealized P/L using current prices if available
      const holdingData = holdings.find(h => `${h.isin}-${h.product}` === key);
      
      if (holding.isOption) {
        // For options: if current price available, calculate unrealized P/L
        // Options have contract size of 100
        // Otherwise use net cash flow
        if (holdingData?.currentPrice !== undefined) {
          optionsUnrealized += (holdingData.currentPrice - holdingData.averagePrice) * holding.quantity * 100;
        } else {
          optionsUnrealized += holding.netCashFlow;
        }
      } else {
        // For stocks: if current price available, calculate unrealized P/L
        // Otherwise show as cost basis (positive value)
        if (holdingData?.currentPrice !== undefined) {
          stocksUnrealized += (holdingData.currentPrice - holdingData.averagePrice) * holding.quantity;
        } else {
          stocksUnrealized += -holding.netCashFlow;
        }
      }
    }
  });

  // Calculate portfolio value based on current holdings
  // Portfolio Value = Stock Holdings Value - Options Holdings Value
  let stocksValue = 0;
  let optionsValue = 0;
  
  holdings.forEach((holding) => {
    if (holding.currentPrice !== undefined && holding.quantity !== 0) {
      const key = `${holding.isin}-${holding.product}`;
      const holdingData = holdingsMap.get(key);
      
      if (holdingData && holdingData.quantity !== 0) {
        if (holdingData.isOption) {
          // Options: quantity * current price * 100 (contract multiplier)
          optionsValue += holding.quantity * holding.currentPrice * 100;
        } else {
          // Stocks: quantity * current price
          stocksValue += holding.quantity * holding.currentPrice;
        }
      }
    }
  });
  
  const portfolioValue = stocksValue - optionsValue;
  
  const optionsPL = optionsRealized;
  const stocksPL = stocksRealized;
  const totalCosts = calculateTotalCosts(transactions);
  const totalRealizedPL = optionsRealized + stocksRealized;
  
  return {
    optionsPL,
    stocksPL,
    portfolioValue,
    totalPL: totalRealizedPL - totalCosts,
    optionsRealized,
    optionsUnrealized,
    stocksRealized,
    stocksUnrealized,
  };
};

export const filterTransactionsByTimeframe = (
  transactions: DeGiroTransaction[],
  timeframe: string
): DeGiroTransaction[] => {
  const now = new Date();
  const getDateFromTransaction = (t: DeGiroTransaction) => {
    return parse(`${t.datum} ${t.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
  };

  switch (timeframe) {
    case '1D':
      return transactions.filter(t => {
        const date = getDateFromTransaction(t);
        return !isNaN(date.getTime()) && (now.getTime() - date.getTime()) <= 24 * 60 * 60 * 1000;
      });
    case '1W':
      return transactions.filter(t => {
        const date = getDateFromTransaction(t);
        return !isNaN(date.getTime()) && (now.getTime() - date.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      });
    case '1M':
      return transactions.filter(t => {
        const date = getDateFromTransaction(t);
        return !isNaN(date.getTime()) && (now.getTime() - date.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      });
    case '3M':
      return transactions.filter(t => {
        const date = getDateFromTransaction(t);
        return !isNaN(date.getTime()) && (now.getTime() - date.getTime()) <= 90 * 24 * 60 * 60 * 1000;
      });
    case '1Y':
      return transactions.filter(t => {
        const date = getDateFromTransaction(t);
        return !isNaN(date.getTime()) && (now.getTime() - date.getTime()) <= 365 * 24 * 60 * 60 * 1000;
      });
    case 'ALL':
    default:
      return transactions;
  }
};

export interface MonthlyReturn {
  month: string;
  realized: number;
  unrealized: number;
  total: number;
}

export interface YearlyReturn {
  year: string;
  realized: number;
  unrealized: number;
  total: number;
}

export const calculateYearlyReturns = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = []
): YearlyReturn[] => {
  const yearlyMap = new Map<string, { realized: number; deposits: number }>();
  const holdingsMap = new Map<string, { totalCost: number; quantity: number }>();
  
  // Process transactions to calculate yearly realized P/L
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit'; data: any }> = [];
  
  transactions.forEach((transaction) => {
    const date = parse(`${transaction.datum} ${transaction.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'transaction', data: transaction });
    }
  });
  
  accountActivities.forEach((activity) => {
    const date = parse(`${activity.datum} ${activity.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime()) && activity.omschrijving.toLowerCase().includes('ideal')) {
      allEvents.push({ date, type: 'deposit', data: activity });
    }
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  allEvents.forEach((event) => {
    const yearKey = format(event.date, 'yyyy');
    
    if (event.type === 'deposit') {
      const existing = yearlyMap.get(yearKey) || { realized: 0, deposits: 0 };
      yearlyMap.set(yearKey, {
        ...existing,
        deposits: existing.deposits + event.data.mutatie,
      });
    } else {
      const transaction = event.data as DeGiroTransaction;
      const key = `${transaction.isin}-${transaction.product}`;
      const existing = holdingsMap.get(key);
      
      if (existing) {
        const newQuantity = existing.quantity + transaction.aantal;
        
        if (newQuantity === 0) {
          // Position closed - realize P/L
          const realizedPL = existing.totalCost + transaction.waarde;
          const yearData = yearlyMap.get(yearKey) || { realized: 0, deposits: 0 };
          yearlyMap.set(yearKey, {
            ...yearData,
            realized: yearData.realized + realizedPL,
          });
          holdingsMap.delete(key);
        } else {
          holdingsMap.set(key, {
            totalCost: existing.totalCost + transaction.waarde,
            quantity: newQuantity,
          });
        }
      } else {
        holdingsMap.set(key, {
          totalCost: transaction.waarde,
          quantity: transaction.aantal,
        });
      }
    }
  });
  
  return Array.from(yearlyMap.entries())
    .map(([year, data]) => ({
      year,
      realized: data.realized,
      unrealized: 0,
      total: data.realized,
    }))
    .sort((a, b) => {
      return parseInt(a.year) - parseInt(b.year);
    });
};

export const calculateMonthlyReturns = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = []
): MonthlyReturn[] => {
  const monthlyMap = new Map<string, { realized: number; deposits: number }>();
  const holdingsMap = new Map<string, { totalCost: number; quantity: number }>();
  
  // Process transactions to calculate monthly realized P/L
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit'; data: any }> = [];
  
  transactions.forEach((transaction) => {
    const date = parse(`${transaction.datum} ${transaction.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'transaction', data: transaction });
    }
  });
  
  accountActivities.forEach((activity) => {
    const date = parse(`${activity.datum} ${activity.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime()) && activity.omschrijving.toLowerCase().includes('ideal')) {
      allEvents.push({ date, type: 'deposit', data: activity });
    }
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  allEvents.forEach((event) => {
    const monthKey = format(event.date, 'MMM yyyy');
    
    if (event.type === 'deposit') {
      const existing = monthlyMap.get(monthKey) || { realized: 0, deposits: 0 };
      monthlyMap.set(monthKey, {
        ...existing,
        deposits: existing.deposits + event.data.mutatie,
      });
    } else {
      const transaction = event.data as DeGiroTransaction;
      const key = `${transaction.isin}-${transaction.product}`;
      const existing = holdingsMap.get(key);
      
      if (existing) {
        const newQuantity = existing.quantity + transaction.aantal;
        
        if (newQuantity === 0) {
          // Position closed - realize P/L
          const realizedPL = existing.totalCost + transaction.waarde;
          const monthData = monthlyMap.get(monthKey) || { realized: 0, deposits: 0 };
          monthlyMap.set(monthKey, {
            ...monthData,
            realized: monthData.realized + realizedPL,
          });
          holdingsMap.delete(key);
        } else {
          holdingsMap.set(key, {
            totalCost: existing.totalCost + transaction.waarde,
            quantity: newQuantity,
          });
        }
      } else {
        holdingsMap.set(key, {
          totalCost: transaction.waarde,
          quantity: transaction.aantal,
        });
      }
    }
  });
  
  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      realized: data.realized,
      unrealized: 0,
      total: data.realized,
    }))
    .sort((a, b) => {
      const dateA = parse(a.month, 'MMM yyyy', new Date());
      const dateB = parse(b.month, 'MMM yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });
};

export const calculateYTDPerformance = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = []
): PortfolioSnapshot[] => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  // Filter transactions for YTD
  const ytdTransactions = transactions.filter(t => {
    const date = parse(`${t.datum} ${t.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    return !isNaN(date.getTime()) && date >= startOfYear;
  });
  
  const ytdActivities = accountActivities.filter(a => {
    const date = parse(`${a.datum} ${a.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    return !isNaN(date.getTime()) && date >= startOfYear;
  });
  
  return calculatePortfolioOverTime(ytdTransactions, ytdActivities);
};

export const calculateCumulativeReturns = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = [],
  portfolioSize: number = 50000
): Array<{ date: Date; percentage: number; value: number }> => {
  const snapshots = calculatePortfolioOverTime(transactions, accountActivities);
  
  return snapshots.map(snapshot => ({
    date: snapshot.date,
    value: snapshot.value,
    percentage: (snapshot.value / portfolioSize) * 100,
  }));
};
