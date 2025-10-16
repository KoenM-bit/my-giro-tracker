import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from '@/components/FileUpload';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { PortfolioChart } from '@/components/PortfolioChart';
import { HoldingsTable } from '@/components/HoldingsTable';
import { TransactionTable } from '@/components/TransactionTable';
import { TimeframeSelector } from '@/components/TimeframeSelector';
import { SettingsDialog } from '@/components/SettingsDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import { TrendingUp, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<DeGiroTransaction[]>([]);
  const [accountActivities, setAccountActivities] = useState<AccountActivity[]>([]);
  const [timeframe, setTimeframe] = useState('ALL');
  const [excludedHoldings, setExcludedHoldings] = useState<Set<string>>(new Set());
  const [currentPrices, setCurrentPrices] = useState<Map<string, number>>(new Map());
  const [portfolioSize, setPortfolioSize] = useState(50000);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
        loadDataFromDatabase(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadDataFromDatabase = async (userId: string) => {
    try {
      // Load transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('datum', { ascending: false });

      if (txError) throw txError;

      if (txData) {
        const mappedTransactions: DeGiroTransaction[] = txData.map(t => ({
          datum: t.datum,
          tijd: t.tijd,
          product: t.product,
          isin: t.isin,
          beurs: t.beurs,
          uitvoeringsplaats: t.uitvoeringsplaats,
          aantal: Number(t.aantal),
          koers: Number(t.koers),
          koersCurrency: t.koers_currency,
          lokaleWaarde: Number(t.lokale_waarde),
          lokaleWaardeCurrency: t.lokale_waarde_currency,
          waarde: Number(t.waarde),
          waardeCurrency: t.waarde_currency,
          wisselkoers: Number(t.wisselkoers),
          transactiekosten: Number(t.transactiekosten),
          transactiekostenCurrency: t.transactiekosten_currency,
          totaal: Number(t.totaal),
          totaalCurrency: t.totaal_currency,
          orderId: t.order_id,
        }));
        setTransactions(mappedTransactions);
      }

      // Load account activities
      const { data: actData, error: actError } = await supabase
        .from('account_activities')
        .select('*')
        .eq('user_id', userId)
        .order('datum', { ascending: false });

      if (actError) throw actError;

      if (actData) {
        const mappedActivities: AccountActivity[] = actData.map(a => ({
          datum: a.datum,
          tijd: a.tijd,
          valutadatum: a.valutadatum,
          product: a.product,
          isin: a.isin,
          omschrijving: a.omschrijving,
          fx: a.fx,
          mutatie: Number(a.mutatie),
          mutatieCurrency: a.mutatie_currency,
          saldo: Number(a.saldo),
          saldoCurrency: a.saldo_currency,
          orderId: a.order_id,
        }));
        setAccountActivities(mappedActivities);
      }

      // Load current prices
      const { data: pricesData, error: pricesError } = await supabase
        .from('current_prices')
        .select('*')
        .eq('user_id', userId);

      if (pricesError) throw pricesError;

      if (pricesData) {
        const pricesMap = new Map<string, number>();
        pricesData.forEach(p => {
          pricesMap.set(p.isin, Number(p.current_price));
        });
        setCurrentPrices(pricesMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data from database');
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      const parsedTransactions = await parseDeGiroCSV(file);
      
      // Save to database
      if (user) {
        const { error } = await supabase.from('transactions').insert(
          parsedTransactions.map(t => ({
            user_id: user.id,
            datum: t.datum,
            tijd: t.tijd,
            product: t.product,
            isin: t.isin,
            beurs: t.beurs,
            uitvoeringsplaats: t.uitvoeringsplaats,
            aantal: t.aantal,
            koers: t.koers,
            koers_currency: t.koersCurrency,
            lokale_waarde: t.lokaleWaarde,
            lokale_waarde_currency: t.lokaleWaardeCurrency,
            waarde: t.waarde,
            waarde_currency: t.waardeCurrency,
            wisselkoers: t.wisselkoers,
            transactiekosten: t.transactiekosten,
            transactiekosten_currency: t.transactiekostenCurrency,
            totaal: t.totaal,
            totaal_currency: t.totaalCurrency,
            order_id: t.orderId,
          }))
        );

        if (error) throw error;
        await loadDataFromDatabase(user.id);
        toast.success(`Successfully imported ${parsedTransactions.length} transactions`);
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file. Please check the format.');
    }
  };

  const handleAccountActivitySelect = async (file: File) => {
    try {
      const parsedActivities = await parseAccountActivityCSV(file);
      
      // Save to database
      if (user) {
        const { error } = await supabase.from('account_activities').insert(
          parsedActivities.map(a => ({
            user_id: user.id,
            datum: a.datum,
            tijd: a.tijd,
            valutadatum: a.valutadatum,
            product: a.product,
            isin: a.isin,
            omschrijving: a.omschrijving,
            fx: a.fx,
            mutatie: a.mutatie,
            mutatie_currency: a.mutatieCurrency,
            saldo: a.saldo,
            saldo_currency: a.saldoCurrency,
            order_id: a.orderId,
          }))
        );

        if (error) throw error;
        await loadDataFromDatabase(user.id);
        toast.success(`Successfully imported ${parsedActivities.length} account activities`);
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse account activity CSV file. Please check the format.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
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

  const handlePriceUpdate = async (isin: string, product: string, price: number) => {
    setCurrentPrices(prev => new Map(prev).set(isin, price));
    
    // Save to database
    if (user) {
      try {
        const { error } = await supabase
          .from('current_prices')
          .upsert({
            user_id: user.id,
            isin: isin,
            current_price: price,
          }, {
            onConflict: 'user_id,isin'
          });

        if (error) throw error;
        toast.success('Price saved');
      } catch (error) {
        console.error('Error saving price:', error);
        toast.error('Failed to save price');
      }
    }
  };

  const filteredTransactions = filterTransactionsByTimeframe(transactions, timeframe);
  const allHoldings = calculateHoldings(transactions).map(holding => {
    return {
      ...holding,
      currentPrice: currentPrices.get(holding.isin),
    };
  });
  const holdings = allHoldings.filter(h => !excludedHoldings.has(`${h.isin}-${h.product}`));
  const totalCosts = calculateTotalCosts(transactions);
  const portfolioSnapshots = calculatePortfolioOverTime(filteredTransactions, accountActivities);
  const { 
    optionsPL, 
    stocksPL,
    portfolioValue,
    totalPL, 
    optionsRealized, 
    optionsUnrealized, 
    stocksRealized, 
    stocksUnrealized 
  } = calculateProfitLossByType(transactions, allHoldings);

  // Separate holdings and transactions for stocks and options
  const optionPattern = /[CP]\d{2,}/;
  const stockHoldings = allHoldings.filter(h => !optionPattern.test(h.product));
  const optionHoldings = allHoldings.filter(h => optionPattern.test(h.product));
  const stockTransactions = transactions.filter(t => !optionPattern.test(t.product));
  const optionTransactions = transactions.filter(t => optionPattern.test(t.product));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (transactions.length === 0 && accountActivities.length === 0) {
    return (
      <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
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
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
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
            
            <div className="flex gap-2">
              <SettingsDialog 
                portfolioSize={portfolioSize}
                onPortfolioSizeChange={setPortfolioSize}
              />
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          
          <div className="mb-6">
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
            totalValue={portfolioValue}
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
          <PortfolioChart 
            data={portfolioSnapshots} 
            timeframe={timeframe}
            currentTotalPL={totalPL}
            transactions={transactions}
            accountActivities={accountActivities}
            portfolioSize={portfolioSize}
          />
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
              onPriceUpdate={handlePriceUpdate}
            />
            <TransactionTable transactions={stockTransactions} />
          </TabsContent>

          <TabsContent value="options" className="space-y-6">
            <HoldingsTable 
              holdings={optionHoldings} 
              excludedHoldings={excludedHoldings}
              onToggleExclusion={toggleHoldingExclusion}
              onPriceUpdate={handlePriceUpdate}
            />
            <TransactionTable transactions={optionTransactions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
