import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('FileUpload: handleFileChange triggered');
    const file = event.target.files?.[0];
    console.log('FileUpload: file selected:', file?.name, file?.size);
    if (file) {
      console.log('FileUpload: calling onFileSelect');
      onFileSelect(file);
    } else {
      console.log('FileUpload: no file selected');
    }
  };

  return (
    <Card className="p-8 border-2 border-dashed border-border hover:border-primary transition-colors">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Upload DeGiro Transactions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your CSV file from DeGiro to analyze your portfolio
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          Select CSV File
        </Button>
      </div>
    </Card>
  );
};
