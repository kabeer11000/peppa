import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle, ExternalLink, FileDown } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface EmulatorFile {
  path: string;
  name: string;
  description: string;
  required: boolean;
}

const REQUIRED_FILES: EmulatorFile[] = [
  {
    path: '/v86/libv86.js',
    name: 'V86 Library',
    description: 'Main emulator library',
    required: true
  },
  {
    path: '/v86/v86.wasm',
    name: 'V86 WebAssembly',
    description: 'WebAssembly binary for the emulator',
    required: true
  },
  {
    path: '/v86/bios/seabios.bin',
    name: 'SeaBIOS',
    description: 'BIOS firmware',
    required: true
  },
  {
    path: '/v86/bios/vgabios.bin',
    name: 'VGA BIOS',
    description: 'Video BIOS firmware',
    required: true
  },
  {
    path: '/v86/images/linux.iso',
    name: 'Linux ISO',
    description: 'Linux system image',
    required: true
  }
];

export function EmulatorCheck() {
  const [missingFiles, setMissingFiles] = useState<EmulatorFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const checkFiles = async () => {
      const missing: EmulatorFile[] = [];

      for (const file of REQUIRED_FILES) {
        try {
          const response = await fetch(file.path, { method: 'HEAD' });
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
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-muted-foreground">
            Checking emulator files...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (missingFiles.length === 0) {
    return null;
  }

  const requiredMissing = missingFiles.filter(f => f.required);
  const optionalMissing = missingFiles.filter(f => !f.required);

  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-500">
          <AlertCircle className="h-5 w-5" />
          Emulator Files Missing
        </CardTitle>
        <CardDescription>
          Some required files are missing for the V86 emulator to work properly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Required Files Missing</AlertTitle>
          <AlertDescription>
            {requiredMissing.length === 1 
              ? 'One required file is missing'
              : `${requiredMissing.length} required files are missing`
            }
            {showDetails && (
              <ScrollArea className="h-[200px] mt-2">
                <div className="space-y-2">
                  {requiredMissing.map((file) => (
                    <div key={file.path} className="rounded-md bg-destructive/10 p-2">
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm opacity-90">{file.description}</div>
                      <code className="text-xs block mt-1 opacity-75">{file.path}</code>
                    </div>
                  ))}
                  {optionalMissing.length > 0 && (
                    <>
                      <div className="text-sm font-medium mt-4 mb-2">Optional Files:</div>
                      {optionalMissing.map((file) => (
                        <div key={file.path} className="rounded-md bg-muted p-2">
                          <div className="font-medium">{file.name}</div>
                          <div className="text-sm opacity-90">{file.description}</div>
                          <code className="text-xs block mt-1 opacity-75">{file.path}</code>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2"
        >
          <FileDown className="h-4 w-4" />
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>
        <Button 
          variant="secondary"
          onClick={() => window.open('https://github.com/copy/v86/releases', '_blank')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Download V86 Files
        </Button>
      </CardFooter>
    </Card>
  );
} 