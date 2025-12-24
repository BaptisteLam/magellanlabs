/**
 * ImportDataDialog - Dialog pour importer des données dans un widget
 * Sources supportées : JSON, Excel, CSV, Google Sheets, Database
 * Design : Respecte la DA Magellan (cyan #03A5C0, glassmorphism)
 */

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { dataImportService, ImportedData, DatabaseConnection } from '@/services/dataImportService';
import {
  FileJson,
  FileSpreadsheet,
  Database,
  Upload,
  Loader2,
  CheckCircle2,
  Table as TableIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ImportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: string;
  onImportComplete?: (data: ImportedData) => void;
}

export function ImportDataDialog({
  open,
  onOpenChange,
  widgetId,
  onImportComplete,
}: ImportDataDialogProps) {
  const [activeTab, setActiveTab] = useState('json');
  const [isImporting, setIsImporting] = useState(false);
  const [importedData, setImportedData] = useState<ImportedData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets state
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetRange, setSheetRange] = useState('A1:Z1000');

  // Database state
  const [dbConnection, setDbConnection] = useState<DatabaseConnection>({
    type: 'postgresql',
    query: 'SELECT * FROM your_table LIMIT 100',
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportedData(null);
    }
  };

  const handleImportFile = async () => {
    if (!selectedFile) {
      toast({
        title: 'Aucun fichier sélectionné',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      let data: ImportedData;

      const ext = selectedFile.name.split('.').pop()?.toLowerCase();

      if (ext === 'json') {
        data = await dataImportService.importJSON(selectedFile);
      } else if (ext === 'xlsx' || ext === 'xls') {
        data = await dataImportService.importExcel(selectedFile);
      } else if (ext === 'csv') {
        data = await dataImportService.importCSV(selectedFile);
      } else {
        throw new Error('Format de fichier non supporté');
      }

      setImportedData(data);

      toast({
        title: 'Import réussi !',
        description: `${data.metadata?.rowCount} lignes importées`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur d\'import',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportGoogleSheets = async () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: 'ID manquant',
        description: 'Veuillez entrer l\'ID du Google Sheet',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const data = await dataImportService.importGoogleSheets(spreadsheetId, sheetRange);
      setImportedData(data);

      toast({
        title: 'Import Google Sheets réussi !',
        description: `${data.metadata?.rowCount} lignes importées`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur Google Sheets',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDatabase = async () => {
    if (!dbConnection.query.trim()) {
      toast({
        title: 'Requête manquante',
        description: 'Veuillez entrer une requête SQL',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const data = await dataImportService.importFromDatabase(dbConnection);
      setImportedData(data);

      toast({
        title: 'Import Database réussi !',
        description: `${data.metadata?.rowCount} lignes importées`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur Database',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveData = async () => {
    if (!importedData) return;

    setIsImporting(true);
    try {
      await dataImportService.saveImportedData(widgetId, importedData);

      toast({
        title: 'Données sauvegardées !',
        description: 'Les données ont été liées au widget',
      });

      if (onImportComplete) {
        onImportComplete(importedData);
      }

      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast({
        title: 'Erreur de sauvegarde',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setImportedData(null);
    setSpreadsheetId('');
    setDbConnection({
      type: 'postgresql',
      query: 'SELECT * FROM your_table LIMIT 100',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-md border-[#03A5C0]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5 text-[#03A5C0]" />
            Importer des Données
          </DialogTitle>
          <DialogDescription>
            Importez des données depuis différentes sources pour alimenter votre widget
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="json" className="gap-2">
              <FileJson className="w-4 h-4" />
              JSON
            </TabsTrigger>
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Excel/CSV
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2">
              <TableIcon className="w-4 h-4" />
              Google Sheets
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="w-4 h-4" />
              Database
            </TabsTrigger>
          </TabsList>

          {/* Tab JSON / Excel / CSV */}
          <TabsContent value="json" className="space-y-4">
            <FileImportTab
              fileInputRef={fileInputRef}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onImport={handleImportFile}
              isImporting={isImporting}
              accept=".json"
              title="Fichier JSON"
              description="Format attendu : array ou {rows: array}"
            />
          </TabsContent>

          <TabsContent value="excel" className="space-y-4">
            <FileImportTab
              fileInputRef={fileInputRef}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onImport={handleImportFile}
              isImporting={isImporting}
              accept=".xlsx,.xls,.csv"
              title="Fichier Excel ou CSV"
              description="Formats supportés : .xlsx, .xls, .csv"
            />
          </TabsContent>

          {/* Tab Google Sheets */}
          <TabsContent value="google" className="space-y-4">
            <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="space-y-2">
                <Label htmlFor="spreadsheet-id">ID du Google Sheet</Label>
                <Input
                  id="spreadsheet-id"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Trouvez l'ID dans l'URL : docs.google.com/spreadsheets/d/<strong>ID</strong>/edit
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet-range">Plage de cellules</Label>
                <Input
                  id="sheet-range"
                  placeholder="A1:Z1000"
                  value={sheetRange}
                  onChange={(e) => setSheetRange(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Ex: A1:Z1000 (1000 premières lignes, colonnes A à Z)
                </p>
              </div>

              <Button
                onClick={handleImportGoogleSheets}
                disabled={isImporting || !spreadsheetId}
                className="w-full bg-[#03A5C0] hover:bg-[#03A5C0]/90"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importer depuis Google Sheets
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Tab Database */}
          <TabsContent value="database" className="space-y-4">
            <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="space-y-2">
                <Label htmlFor="db-type">Type de base de données</Label>
                <Select
                  value={dbConnection.type}
                  onValueChange={(value: any) =>
                    setDbConnection({ ...dbConnection, type: value })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="supabase">Supabase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dbConnection.type !== 'supabase' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db-host">Host</Label>
                    <Input
                      id="db-host"
                      placeholder="localhost"
                      value={dbConnection.host || ''}
                      onChange={(e) =>
                        setDbConnection({ ...dbConnection, host: e.target.value })
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db-port">Port</Label>
                    <Input
                      id="db-port"
                      type="number"
                      placeholder="5432"
                      value={dbConnection.port || ''}
                      onChange={(e) =>
                        setDbConnection({ ...dbConnection, port: Number(e.target.value) })
                      }
                      className="bg-background"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="db-query">Requête SQL</Label>
                <Textarea
                  id="db-query"
                  placeholder="SELECT * FROM your_table LIMIT 100"
                  value={dbConnection.query}
                  onChange={(e) =>
                    setDbConnection({ ...dbConnection, query: e.target.value })
                  }
                  className="bg-background font-mono text-sm min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Entrez votre requête SQL (SELECT uniquement)
                </p>
              </div>

              <Button
                onClick={handleImportDatabase}
                disabled={isImporting || !dbConnection.query}
                className="w-full bg-[#03A5C0] hover:bg-[#03A5C0]/90"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Importer depuis Database
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview des données importées */}
        <AnimatePresence>
          {importedData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 p-4 rounded-lg border border-[#03A5C0]/30 bg-[#03A5C0]/5"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-[#03A5C0]">
                <CheckCircle2 className="w-4 h-4" />
                Données importées avec succès
              </div>
              <div className="text-sm text-muted-foreground">
                {importedData.metadata?.rowCount} lignes • {importedData.metadata?.columnCount}{' '}
                colonnes
              </div>
              <div className="flex gap-2 flex-wrap">
                {importedData.columns.slice(0, 5).map((col) => (
                  <div
                    key={col.key}
                    className="px-2 py-1 rounded bg-muted text-xs font-mono"
                  >
                    {col.label} ({col.type})
                  </div>
                ))}
                {importedData.columns.length > 5 && (
                  <div className="px-2 py-1 rounded bg-muted text-xs">
                    +{importedData.columns.length - 5} colonnes
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSaveData}
            disabled={!importedData || isImporting}
            className="bg-[#03A5C0] hover:bg-[#03A5C0]/90"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              'Lier au widget'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Composant réutilisable pour l'import de fichiers
 */
function FileImportTab({
  fileInputRef,
  selectedFile,
  onFileSelect,
  onImport,
  isImporting,
  accept,
  title,
  description,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectedFile: File | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  isImporting: boolean;
  accept: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
      <div className="space-y-2">
        <Label>{title}</Label>
        <div className="flex gap-2">
          <Input
            type="file"
            ref={fileInputRef}
            onChange={onFileSelect}
            accept={accept}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            Sélectionner un fichier
          </Button>
        </div>
        {selectedFile && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            {selectedFile.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <Button
        onClick={onImport}
        disabled={!selectedFile || isImporting}
        className="w-full bg-[#03A5C0] hover:bg-[#03A5C0]/90"
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Import en cours...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Importer le fichier
          </>
        )}
      </Button>
    </div>
  );
}
