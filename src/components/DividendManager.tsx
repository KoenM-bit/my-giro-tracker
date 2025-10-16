import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Dividend } from '@/types/transaction';
import { Trash2, Plus, DollarSign } from 'lucide-react';
import { format, parse } from 'date-fns';

interface DividendManagerProps {
  dividends: Dividend[];
  onAddDividend: (amount: number, date: string, description?: string) => void;
  onDeleteDividend: (id: string) => void;
}

export const DividendManager = ({ 
  dividends, 
  onAddDividend, 
  onDeleteDividend 
}: DividendManagerProps) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      return;
    }
    
    onAddDividend(parsedAmount, date, description || undefined);
    setAmount('');
    setDescription('');
    setDate(format(new Date(), 'dd-MM-yyyy'));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const totalDividends = dividends.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-success" />
        <h3 className="text-lg font-semibold">Dividend Tracking</h3>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="dividend-amount">Amount (EUR)</Label>
            <Input
              id="dividend-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
            />
          </div>
          
          <div>
            <Label htmlFor="dividend-date">Date</Label>
            <Input
              id="dividend-date"
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="dd-MM-yyyy"
            />
          </div>
          
          <div>
            <Label htmlFor="dividend-description">Description (optional)</Label>
            <Input
              id="dividend-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Company dividend"
            />
          </div>
        </div>
        
        <Button onClick={handleAdd} className="w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Dividend
        </Button>

        {dividends.length > 0 && (
          <>
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">Recorded Dividends</h4>
                <span className="text-sm font-semibold text-success">
                  Total: {formatCurrency(totalDividends)}
                </span>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dividends
                  .sort((a, b) => {
                    const dateA = parse(a.date, 'dd-MM-yyyy', new Date());
                    const dateB = parse(b.date, 'dd-MM-yyyy', new Date());
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((dividend) => (
                    <div 
                      key={dividend.id} 
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-success">
                            {formatCurrency(dividend.amount)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {dividend.date}
                          </span>
                        </div>
                        {dividend.description && (
                          <span className="text-sm text-muted-foreground">
                            {dividend.description}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteDividend(dividend.id)}
                        className="ml-2"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
