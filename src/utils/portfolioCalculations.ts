import { DeGiroTransaction, PortfolioHolding, PortfolioSnapshot, AccountActivity, PriceHistory, Dividend } from '@/types/transaction';
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

export const calculateRealizedPLOverTime = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = []
): PortfolioSnapshot[] => {
  // Track holdings to identify when positions are closed and realize P/L
  const holdingsMap = new Map<string, { totalCost: number; quantity: number }>();
  const snapshots: PortfolioSnapshot[] = [];
  let realizedValue = 0; // Track deposits + realized P/L only
  
  // Combine transaction and deposit events
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
      // Deposits add to realized value
      realizedValue += event.data.mutatie;
    } else {
      // Transaction - only affects realized value when position closes
      const transaction = event.data as DeGiroTransaction;
      const key = `${transaction.isin}-${transaction.product}`;
      const existing = holdingsMap.get(key);
      
      if (existing) {
        const newQuantity = existing.quantity + transaction.aantal;
        
        if (newQuantity === 0) {
          // Position fully closed - realize P/L
          const realizedPL = existing.totalCost + transaction.waarde;
          realizedValue += realizedPL;
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
          realizedValue += realizedPL;
          
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
    
    // Only track realized value (no unrealized)
    snapshots.push({
      date: event.date,
      value: realizedValue,
    });
  });
  
  return snapshots;
};

export const calculatePortfolioOverTime = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = [],
  priceHistory: PriceHistory[] = [],
  currentPrices: Map<string, number> = new Map()
): PortfolioSnapshot[] => {
  // Track holdings to identify when positions are closed and realize P/L
  const holdingsMap = new Map<string, { totalCost: number; quantity: number; isin: string; product: string; isOption: boolean }>();
  const snapshots: PortfolioSnapshot[] = [];
  let realizedValue = 0; // Track deposits + realized P/L only
  
  // Helper to calculate unrealized value at a given time with specific prices
  const calculateUnrealizedValue = (prices: Map<string, number>) => {
    let unrealized = 0;
    holdingsMap.forEach((holding) => {
      if (holding.quantity !== 0) {
        const currentPrice = prices.get(holding.isin);
        if (currentPrice !== undefined) {
          const avgPrice = Math.abs(holding.totalCost / holding.quantity);
          const multiplier = holding.isOption ? 100 : 1;
          unrealized += (currentPrice - avgPrice) * holding.quantity * multiplier;
        }
      }
    });
    return unrealized;
  };
  
  // Combine all events
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit' | 'price_update'; data: any }> = [];
  
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
  
  priceHistory.forEach((priceUpdate) => {
    const date = new Date(priceUpdate.timestamp);
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'price_update', data: priceUpdate });
    }
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Track prices as they change over time
  const historicalPrices = new Map<string, number>();
  
  allEvents.forEach((event) => {
    if (event.type === 'deposit') {
      // Deposits add to realized value
      realizedValue += event.data.mutatie;
    } else if (event.type === 'price_update') {
      // Update the historical price for this security
      const priceUpdate = event.data as PriceHistory;
      historicalPrices.set(priceUpdate.isin, priceUpdate.price);
    } else {
      // Transaction - only affects realized value when position closes
      const transaction = event.data as DeGiroTransaction;
      const key = `${transaction.isin}-${transaction.product}`;
      const optionPattern = /[CP]\d{2,}/;
      const isOption = optionPattern.test(transaction.product);
      const existing = holdingsMap.get(key);
      
      if (existing) {
        const newQuantity = existing.quantity + transaction.aantal;
        const transactionCost = Math.abs(transaction.waarde);
        
        if (newQuantity === 0) {
          // Position fully closed - realize P/L
          const realizedPL = existing.totalCost + transaction.waarde;
          realizedValue += realizedPL;
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
          realizedValue += realizedPL;
          
          // Update remaining position
          const remainingQuantity = existing.quantity + transaction.aantal;
          const remainingCost = existing.totalCost - closedCost;
          holdingsMap.set(key, {
            ...existing,
            totalCost: remainingCost,
            quantity: remainingQuantity,
          });
        } else {
          // Adding to position - no realized P/L
          holdingsMap.set(key, {
            ...existing,
            totalCost: existing.totalCost + transaction.waarde,
            quantity: newQuantity,
          });
        }
      } else {
        // New position - no realized P/L
        holdingsMap.set(key, {
          totalCost: transaction.waarde,
          quantity: transaction.aantal,
          isin: transaction.isin,
          product: transaction.product,
          isOption,
        });
      }
    }
    
    // Calculate total portfolio value = realized + unrealized
    const unrealizedValue = calculateUnrealizedValue(historicalPrices);
    snapshots.push({
      date: event.date,
      value: realizedValue + unrealizedValue,
    });
  });
  
  // If we have current prices but no recent price history events, add a final snapshot
  if (currentPrices.size > 0 && snapshots.length > 0) {
    const lastSnapshot = snapshots[snapshots.length - 1];
    const unrealizedValue = calculateUnrealizedValue(currentPrices);
    const currentValue = realizedValue + unrealizedValue;
    
    // Only add if the value is different
    if (Math.abs(currentValue - lastSnapshot.value) > 0.01) {
      snapshots.push({
        date: new Date(),
        value: currentValue,
      });
    }
  }
  
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
  // Portfolio Value = Sum of all current holdings (quantity * price)
  // For stocks: quantity * current price
  // For options: quantity * current price * 100 (contract multiplier)
  let portfolioValue = 0;
  
  holdings.forEach((holding) => {
    if (holding.currentPrice !== undefined && holding.quantity !== 0) {
      const key = `${holding.isin}-${holding.product}`;
      const holdingData = holdingsMap.get(key);
      
      if (holdingData && holdingData.quantity !== 0) {
        if (holdingData.isOption) {
          // Options: quantity * current price * 100 (contract multiplier)
          portfolioValue += holding.quantity * holding.currentPrice * 100;
        } else {
          // Stocks: quantity * current price
          portfolioValue += holding.quantity * holding.currentPrice;
        }
      }
    }
  });
  
  const optionsPL = optionsRealized + optionsUnrealized;
  const stocksPL = stocksRealized + stocksUnrealized;
  const totalCosts = calculateTotalCosts(transactions);
  const totalPL = optionsRealized + optionsUnrealized + stocksRealized + stocksUnrealized;
  
  return {
    optionsPL,
    stocksPL,
    portfolioValue,
    totalPL: totalPL - totalCosts,
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
  accountActivities: AccountActivity[] = [],
  dividends: Dividend[] = []
): YearlyReturn[] => {
  const yearlyMap = new Map<string, { realized: number; deposits: number; dividends: number }>();
  const holdingsMap = new Map<string, { totalCost: number; quantity: number }>();
  
  // Process transactions to calculate yearly realized P/L
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit' | 'dividend'; data: any }> = [];
  
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
  
  dividends.forEach((dividend) => {
    const date = parse(dividend.date, 'dd-MM-yyyy', new Date());
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'dividend', data: dividend });
    }
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  allEvents.forEach((event) => {
    const yearKey = format(event.date, 'yyyy');
    
    if (event.type === 'deposit') {
      const existing = yearlyMap.get(yearKey) || { realized: 0, deposits: 0, dividends: 0 };
      yearlyMap.set(yearKey, {
        ...existing,
        deposits: existing.deposits + event.data.mutatie,
      });
    } else if (event.type === 'dividend') {
      const existing = yearlyMap.get(yearKey) || { realized: 0, deposits: 0, dividends: 0 };
      yearlyMap.set(yearKey, {
        ...existing,
        dividends: existing.dividends + event.data.amount,
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
          const yearData = yearlyMap.get(yearKey) || { realized: 0, deposits: 0, dividends: 0 };
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
      realized: data.realized + data.dividends,
      unrealized: 0,
      total: data.realized + data.dividends,
    }))
    .sort((a, b) => {
      return parseInt(a.year) - parseInt(b.year);
    });
};

export const calculateMonthlyReturns = (
  transactions: DeGiroTransaction[],
  accountActivities: AccountActivity[] = [],
  dividends: Dividend[] = []
): MonthlyReturn[] => {
  const monthlyMap = new Map<string, { realized: number; deposits: number; dividends: number }>();
  const holdingsMap = new Map<string, { totalCost: number; quantity: number }>();
  
  // Process transactions to calculate monthly realized P/L
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit' | 'dividend'; data: any }> = [];
  
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
  
  dividends.forEach((dividend) => {
    const date = parse(dividend.date, 'dd-MM-yyyy', new Date());
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'dividend', data: dividend });
    }
  });
  
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  allEvents.forEach((event) => {
    const monthKey = format(event.date, 'MMM yyyy');
    
    if (event.type === 'deposit') {
      const existing = monthlyMap.get(monthKey) || { realized: 0, deposits: 0, dividends: 0 };
      monthlyMap.set(monthKey, {
        ...existing,
        deposits: existing.deposits + event.data.mutatie,
      });
    } else if (event.type === 'dividend') {
      const existing = monthlyMap.get(monthKey) || { realized: 0, deposits: 0, dividends: 0 };
      monthlyMap.set(monthKey, {
        ...existing,
        dividends: existing.dividends + event.data.amount,
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
          const monthData = monthlyMap.get(monthKey) || { realized: 0, deposits: 0, dividends: 0 };
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
      realized: data.realized + data.dividends,
      unrealized: 0,
      total: data.realized + data.dividends,
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
