import { DeGiroTransaction, PortfolioHolding, PortfolioSnapshot, AccountActivity } from '@/types/transaction';
import { parse } from 'date-fns';

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
  // Track holdings over time to calculate portfolio value properly
  const holdingsOverTime = new Map<string, { quantity: number; avgPrice: number; isOption: boolean }>();
  const snapshots: PortfolioSnapshot[] = [];
  let realizedCash = 0; // Track realized gains/losses from closed positions
  
  // Combine transactions and deposits
  const allEvents: Array<{ date: Date; type: 'transaction' | 'deposit'; data: any }> = [];
  
  // Add transactions
  transactions.forEach((transaction) => {
    const date = parse(`${transaction.datum} ${transaction.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime())) {
      allEvents.push({ date, type: 'transaction', data: transaction });
    }
  });
  
  // Add deposits/withdrawals
  accountActivities.forEach((activity) => {
    const date = parse(`${activity.datum} ${activity.tijd}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!isNaN(date.getTime()) && activity.omschrijving.toLowerCase().includes('ideal')) {
      allEvents.push({ date, type: 'deposit', data: activity });
    }
  });
  
  // Sort all events by date
  allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  allEvents.forEach((event) => {
    if (event.type === 'deposit') {
      // Deposits add to realized cash
      realizedCash += event.data.mutatie;
    } else {
      // Transaction
      const transaction = event.data as DeGiroTransaction;
      const key = `${transaction.isin}-${transaction.product}`;
      const isOption = isOptionTransaction(transaction);
      const existing = holdingsOverTime.get(key);
      
      if (existing) {
        const newQuantity = existing.quantity + transaction.aantal;
        
        if (newQuantity === 0) {
          // Position closed - realize the gain/loss
          const totalCost = existing.quantity * existing.avgPrice;
          const totalSale = -transaction.aantal * Math.abs(transaction.koers);
          realizedCash += totalSale - Math.abs(totalCost);
          holdingsOverTime.delete(key);
        } else if ((existing.quantity > 0 && newQuantity > 0) || (existing.quantity < 0 && newQuantity < 0)) {
          // Same direction - update average price
          const totalCost = existing.quantity * existing.avgPrice + transaction.aantal * Math.abs(transaction.koers);
          holdingsOverTime.set(key, {
            quantity: newQuantity,
            avgPrice: Math.abs(totalCost / newQuantity),
            isOption,
          });
        } else {
          // Partial close
          const closedQuantity = existing.quantity > 0 ? Math.min(existing.quantity, -transaction.aantal) : Math.max(existing.quantity, -transaction.aantal);
          const remainingQuantity = existing.quantity + transaction.aantal;
          const totalCost = closedQuantity * existing.avgPrice;
          const totalSale = -closedQuantity * Math.abs(transaction.koers);
          realizedCash += totalSale - Math.abs(totalCost);
          
          if (remainingQuantity !== 0) {
            holdingsOverTime.set(key, {
              quantity: remainingQuantity,
              avgPrice: existing.avgPrice,
              isOption,
            });
          } else {
            holdingsOverTime.delete(key);
          }
        }
      } else {
        // New position
        holdingsOverTime.set(key, {
          quantity: transaction.aantal,
          avgPrice: Math.abs(transaction.koers),
          isOption,
        });
      }
    }
    
    // Calculate current portfolio value = realized cash + value of current holdings
    let holdingsValue = 0;
    holdingsOverTime.forEach((holding) => {
      // For unrealized holdings, value = cost basis (what we paid)
      holdingsValue += Math.abs(holding.quantity * holding.avgPrice);
    });
    
    const portfolioValue = realizedCash + holdingsValue;
    
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

  // For portfolio value and P/L:
  // Portfolio Value = realized cash + current holdings value
  // P/L = realized gains only for main calculation, unrealized shown separately
  const optionsPL = optionsRealized;
  const stocksPL = stocksRealized;
  const portfolioValue = optionsRealized + stocksRealized + optionsUnrealized + stocksUnrealized;
  const totalCosts = calculateTotalCosts(transactions);
  
  return {
    optionsPL,
    stocksPL,
    portfolioValue,
    totalPL: portfolioValue - totalCosts,
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
