import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';

export function EmulatorCheck() {
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const checkFiles = async () => {
      const files = [
        '/v86/libv86.js',
        '/v86/v86.wasm',
        '/v86/bios/seabios.bin',
        '/v86/bios/vgabios.bin',
        '/v86/images/linux.iso',
      ];

      const missing: string[] = [];

      for (const file of files) {
        try {
          const response = await fetch(file, { method: 'HEAD' });
          if (!response.ok) {
            missing.push(file);
          }
        } catch (error) {
          missing.push(file);
        }
      }

      setMissingFiles(missing);
      setIsLoading(false);
    };

    checkFiles();
  }, []);

  if (isLoading) {
    return <div>Checking emulator files...</div>;
  }

  if (missingFiles.length === 0) {
    return null; // All files are present, no need to show anything
  }

  return (
    <Card className="mb-8 border-amber-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Emulator Files Missing
        </CardTitle>
        <CardDescription>
          The V86 emulator needs additional files to work properly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Files not found</AlertTitle>
          <AlertDescription>
            {missingFiles.length === 1 
              ? `The following file is missing: ${missingFiles[0]}`
              : `${missingFiles.length} emulator files are missing.`
            }
            {showDetails && (
              <ul className="mt-2 list-disc pl-5">
                {missingFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>
        <Button 
          variant="secondary"
          onClick={() => window.open('https://github.com/copy/v86/releases', '_blank')}
        >
          Get V86 Files
        </Button>
      </CardFooter>
    </Card>
  );
} 