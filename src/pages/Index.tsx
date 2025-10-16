import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { PortfolioChart } from '@/components/PortfolioChart';
import { HoldingsTable } from '@/components/HoldingsTable';
import { TransactionTable } from '@/components/TransactionTable';
import { TimeframeSelector } from '@/components/TimeframeSelector';
import { DeGiroTransaction } from '@/types/transaction';
import { parseDeGiroCSV } from '@/utils/csvParser';
import {
  calculateHoldings,
  calculatePortfolioValue,
  calculatePortfolioOverTime,
  calculateTotalCosts,
  filterTransactionsByTimeframe,
} from '@/utils/portfolioCalculations';
import { toast } from 'sonner';
import { TrendingUp } from 'lucide-react';

const Index = () => {
  const [transactions, setTransactions] = useState<DeGiroTransaction[]>([]);
  const [timeframe, setTimeframe] = useState('ALL');
  const [excludedHoldings, setExcludedHoldings] = useState<Set<string>>(new Set());

  const handleFileSelect = async (file: File) => {
    try {
      const parsedTransactions = await parseDeGiroCSV(file);
      setTransactions(parsedTransactions);
      toast.success(`Successfully loaded ${parsedTransactions.length} transactions`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file. Please check the format.');
    }
  };

  const toggleHoldingExclusion = (key: string) => {
    setExcludedHoldings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const filteredTransactions = filterTransactionsByTimeframe(transactions, timeframe);
  const allHoldings = calculateHoldings(transactions);
  const holdings = allHoldings.filter(h => !excludedHoldings.has(`${h.isin}-${h.product}`));
  const totalValue = calculatePortfolioValue(transactions);
  const totalCosts = calculateTotalCosts(transactions);
  const portfolioSnapshots = calculatePortfolioOverTime(filteredTransactions);
  const profitLoss = totalValue;

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">DeGiro Portfolio Tracker</h1>
            </div>
            <p className="text-muted-foreground">
              Upload your DeGiro transaction history to analyze your portfolio performance
            </p>
          </div>
          <FileUpload onFileSelect={handleFileSelect} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">DeGiro Portfolio Tracker</h1>
              </div>
              <p className="text-muted-foreground">
                Tracking {transactions.length} transactions
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} />
          </div>

          <PortfolioOverview
            totalValue={totalValue}
            totalCosts={totalCosts}
            profitLoss={profitLoss}
            transactionCount={transactions.length}
          />
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Portfolio Performance</h2>
            <TimeframeSelector
              selectedTimeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </div>
          <PortfolioChart data={portfolioSnapshots} timeframe={timeframe} />
        </div>

        <div className="mb-8">
          <HoldingsTable 
            holdings={allHoldings} 
            excludedHoldings={excludedHoldings}
            onToggleExclusion={toggleHoldingExclusion}
          />
        </div>

        <div>
          <TransactionTable transactions={transactions} />
        </div>
      </div>
    </div>
  );
};

export default Index;
