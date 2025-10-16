import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { PortfolioChart } from '@/components/PortfolioChart';
import { HoldingsTable } from '@/components/HoldingsTable';
import { TransactionTable } from '@/components/TransactionTable';
import { TimeframeSelector } from '@/components/TimeframeSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeGiroTransaction, AccountActivity } from '@/types/transaction';
import { parseDeGiroCSV, parseAccountActivityCSV } from '@/utils/csvParser';
import {
  calculateHoldings,
  calculatePortfolioValue,
  calculatePortfolioOverTime,
  calculateTotalCosts,
  filterTransactionsByTimeframe,
  calculateProfitLossByType,
} from '@/utils/portfolioCalculations';
import { toast } from 'sonner';
import { TrendingUp } from 'lucide-react';

const Index = () => {
  const [transactions, setTransactions] = useState<DeGiroTransaction[]>([]);
  const [accountActivities, setAccountActivities] = useState<AccountActivity[]>([]);
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

  const handleAccountActivitySelect = async (file: File) => {
    try {
      const parsedActivities = await parseAccountActivityCSV(file);
      setAccountActivities(parsedActivities);
      toast.success(`Successfully loaded ${parsedActivities.length} account activities`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse account activity CSV file. Please check the format.');
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
  const portfolioSnapshots = calculatePortfolioOverTime(filteredTransactions, accountActivities);
  const { 
    optionsPL, 
    stocksPL, 
    totalPL, 
    optionsRealized, 
    optionsUnrealized, 
    stocksRealized, 
    stocksUnrealized 
  } = calculateProfitLossByType(transactions);

  // Separate holdings and transactions for stocks and options
  const optionPattern = /[CP]\d{2,}/;
  const stockHoldings = allHoldings.filter(h => !optionPattern.test(h.product));
  const optionHoldings = allHoldings.filter(h => optionPattern.test(h.product));
  const stockTransactions = transactions.filter(t => !optionPattern.test(t.product));
  const optionTransactions = transactions.filter(t => optionPattern.test(t.product));

  if (transactions.length === 0 && accountActivities.length === 0) {
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
          
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="transactions">Transacties</TabsTrigger>
              <TabsTrigger value="account">In/Uitboekingen</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transactions">
              <FileUpload onFileSelect={handleFileSelect} />
            </TabsContent>
            
            <TabsContent value="account">
              <FileUpload onFileSelect={handleAccountActivitySelect} />
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Upload je account mutaties CSV om deposits en withdrawals te importeren
              </p>
            </TabsContent>
          </Tabs>
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
                {transactions.length > 0 && `Tracking ${transactions.length} transactions`}
                {transactions.length > 0 && accountActivities.length > 0 && ' • '}
                {accountActivities.length > 0 && `${accountActivities.length} account activities`}
              </p>
            </div>
            
            <Tabs defaultValue="transactions" className="w-[400px]">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transactions">Transacties</TabsTrigger>
                <TabsTrigger value="account">In/Uitboekingen</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transactions" className="mt-4">
                <FileUpload onFileSelect={handleFileSelect} />
              </TabsContent>
              
              <TabsContent value="account" className="mt-4">
                <FileUpload onFileSelect={handleAccountActivitySelect} />
              </TabsContent>
            </Tabs>
          </div>

          <PortfolioOverview
            totalValue={totalValue}
            totalCosts={totalCosts}
            optionsPL={optionsPL}
            stocksPL={stocksPL}
            totalPL={totalPL}
            optionsRealized={optionsRealized}
            optionsUnrealized={optionsUnrealized}
            stocksRealized={stocksRealized}
            stocksUnrealized={stocksUnrealized}
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

        <Tabs defaultValue="stocks" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="stocks">
              Stocks ({stockHoldings.length})
            </TabsTrigger>
            <TabsTrigger value="options">
              Options ({optionHoldings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stocks" className="space-y-6">
            <HoldingsTable 
              holdings={stockHoldings} 
              excludedHoldings={excludedHoldings}
              onToggleExclusion={toggleHoldingExclusion}
            />
            <TransactionTable transactions={stockTransactions} />
          </TabsContent>

          <TabsContent value="options" className="space-y-6">
            <HoldingsTable 
              holdings={optionHoldings} 
              excludedHoldings={excludedHoldings}
              onToggleExclusion={toggleHoldingExclusion}
            />
            <TransactionTable transactions={optionTransactions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
