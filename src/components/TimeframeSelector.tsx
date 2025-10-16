import { Button } from './ui/button';

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

const timeframes = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

export const TimeframeSelector = ({ selectedTimeframe, onTimeframeChange }: TimeframeSelectorProps) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {timeframes.map((timeframe) => (
        <Button
          key={timeframe}
          variant={selectedTimeframe === timeframe ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTimeframeChange(timeframe)}
        >
          {timeframe}
        </Button>
      ))}
    </div>
  );
};
