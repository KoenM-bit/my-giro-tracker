import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Settings } from "lucide-react";
import { useState } from "react";

interface SettingsDialogProps {
  portfolioSize: number;
  onPortfolioSizeChange: (size: number) => void;
}

export const SettingsDialog = ({ portfolioSize, onPortfolioSizeChange }: SettingsDialogProps) => {
  const [tempSize, setTempSize] = useState(portfolioSize.toString());
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    const size = parseFloat(tempSize);
    if (!isNaN(size) && size > 0) {
      onPortfolioSizeChange(size);
      setOpen(false);
    }
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
          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
