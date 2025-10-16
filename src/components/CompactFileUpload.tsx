import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CompactFileUploadProps {
  onTransactionFileSelect: (file: File) => void;
  onAccountFileSelect: (file: File) => void;
}

export const CompactFileUpload = ({ onTransactionFileSelect, onAccountFileSelect }: CompactFileUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'transactions' | 'account'>('transactions');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (uploadType === 'transactions') {
        onTransactionFileSelect(file);
      } else {
        onAccountFileSelect(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      if (uploadType === 'transactions') {
        onTransactionFileSelect(file);
      } else {
        onAccountFileSelect(file);
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Select value={uploadType} onValueChange={(value) => setUploadType(value as 'transactions' | 'account')}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="transactions">Transacties</SelectItem>
          <SelectItem value="account">In/Uitboekingen</SelectItem>
        </SelectContent>
      </Select>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg transition-all cursor-pointer
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-105' 
            : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'
          }
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {isDragging ? 'Drop CSV here' : 'Drop CSV or click'}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
