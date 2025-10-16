import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Settings } from "lucide-react";
import { useState } from "react";

interface SettingsDialogProps {
  portfolioSize: number;
  onPortfolioSizeChange: (size: number) => void;
  borrowedAmount: number;
  onBorrowedAmountChange: (amount: number) => void;
}

export const SettingsDialog = ({ portfolioSize, onPortfolioSizeChange, borrowedAmount, onBorrowedAmountChange }: SettingsDialogProps) => {
  const [tempSize, setTempSize] = useState(portfolioSize.toString());
  const [tempBorrowed, setTempBorrowed] = useState(borrowedAmount.toString());
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    const size = parseFloat(tempSize);
    const borrowed = parseFloat(tempBorrowed);
    if (!isNaN(size) && size > 0) {
      onPortfolioSizeChange(size);
    }
    if (!isNaN(borrowed) && borrowed >= 0) {
      onBorrowedAmountChange(borrowed);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Portfolio Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="portfolio-size">Initial Portfolio Size (€)</Label>
            <Input
              id="portfolio-size"
              type="number"
              value={tempSize}
              onChange={(e) => setTempSize(e.target.value)}
              placeholder="50000"
            />
            <p className="text-sm text-muted-foreground">
              This value is used to calculate percentage returns
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="borrowed-amount">Borrowed Amount / Margin (€)</Label>
            <Input
              id="borrowed-amount"
              type="number"
              value={tempBorrowed}
              onChange={(e) => setTempBorrowed(e.target.value)}
              placeholder="0"
            />
            <p className="text-sm text-muted-foreground">
              The margin or borrowed money that will be deducted from portfolio value
            </p>
          </div>
          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
