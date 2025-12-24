/**
 * Service d'import de données pour widgets CRM
 * Supporte : JSON, Excel, CSV, Google Sheets, Databases externes
 */

import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

export interface ImportedData {
  rows: any[];
  columns: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'date' | 'boolean';
  }>;
  metadata?: {
    source: 'json' | 'excel' | 'csv' | 'google-sheets' | 'database';
    filename?: string;
    sheetName?: string;
    rowCount: number;
    columnCount: number;
  };
}

export interface DatabaseConnection {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'supabase';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  query: string;
  supabase_url?: string;
  supabase_anon_key?: string;
}

export class DataImportService {
  /**
   * Importe des données depuis un fichier JSON
   */
  async importJSON(file: File): Promise<ImportedData> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Détecter la structure
      let rows: any[];
      if (Array.isArray(data)) {
        rows = data;
      } else if (data.rows && Array.isArray(data.rows)) {
        rows = data.rows;
      } else if (data.data && Array.isArray(data.data)) {
        rows = data.data;
      } else {
        throw new Error('Format JSON invalide. Attendu: array ou {rows: array}');
      }

      if (rows.length === 0) {
        throw new Error('Aucune donnée trouvée dans le fichier JSON');
      }

      // Détecter les colonnes depuis la première ligne
      const columns = this.detectColumns(rows[0]);

      return {
        rows,
        columns,
        metadata: {
          source: 'json',
          filename: file.name,
          rowCount: rows.length,
          columnCount: columns.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Erreur import JSON: ${error.message}`);
    }
  }

  /**
   * Importe des données depuis un fichier Excel (.xlsx, .xls)
   */
  async importExcel(file: File, sheetName?: string): Promise<ImportedData> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      // Sélectionner la feuille
      const targetSheet = sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[targetSheet];

      if (!worksheet) {
        throw new Error(`Feuille "${targetSheet}" introuvable`);
      }

      // Convertir en JSON
      const rows = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        throw new Error('Aucune donnée trouvée dans la feuille Excel');
      }

      // Détecter les colonnes
      const columns = this.detectColumns(rows[0]);

      return {
        rows,
        columns,
        metadata: {
          source: 'excel',
          filename: file.name,
          sheetName: targetSheet,
          rowCount: rows.length,
          columnCount: columns.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Erreur import Excel: ${error.message}`);
    }
  }

  /**
   * Importe des données depuis un fichier CSV
   */
  async importCSV(file: File, delimiter: string = ','): Promise<ImportedData> {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim() !== '');

      if (lines.length === 0) {
        throw new Error('Fichier CSV vide');
      }

      // Parse CSV
      const headers = lines[0].split(delimiter).map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(delimiter).map((v) => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        return row;
      });

      // Détecter les colonnes
      const columns = this.detectColumns(rows[0]);

      return {
        rows,
        columns,
        metadata: {
          source: 'csv',
          filename: file.name,
          rowCount: rows.length,
          columnCount: columns.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Erreur import CSV: ${error.message}`);
    }
  }

  /**
   * Importe des données depuis Google Sheets
   */
  async importGoogleSheets(spreadsheetId: string, range: string = 'A1:Z1000'): Promise<ImportedData> {
    try {
      // Utiliser l'API Google Sheets via edge function pour sécurité
      const { data, error } = await supabase.functions.invoke('import-google-sheets', {
        body: { spreadsheetId, range },
      });

      if (error) {
        throw error;
      }

      if (!data || !data.values || data.values.length === 0) {
        throw new Error('Aucune donnée trouvée dans Google Sheets');
      }

      // Première ligne = headers
      const headers = data.values[0];
      const rows = data.values.slice(1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index];
        });
        return obj;
      });

      const columns = this.detectColumns(rows[0]);

      return {
        rows,
        columns,
        metadata: {
          source: 'google-sheets',
          rowCount: rows.length,
          columnCount: columns.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Erreur import Google Sheets: ${error.message}`);
    }
  }

  /**
   * Importe des données depuis une database externe
   */
  async importFromDatabase(connection: DatabaseConnection): Promise<ImportedData> {
    try {
      // Appeler l'edge function pour sécurité (pas de credentials côté client)
      const { data, error } = await supabase.functions.invoke('import-from-database', {
        body: connection,
      });

      if (error) {
        throw error;
      }

      if (!data || !data.rows || data.rows.length === 0) {
        throw new Error('Aucune donnée retournée par la requête');
      }

      const columns = this.detectColumns(data.rows[0]);

      return {
        rows: data.rows,
        columns,
        metadata: {
          source: 'database',
          rowCount: data.rows.length,
          columnCount: columns.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Erreur import Database: ${error.message}`);
    }
  }

  /**
   * Détecte automatiquement les colonnes et leurs types depuis un objet
   */
  private detectColumns(sampleRow: any): Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'date' | 'boolean';
  }> {
    if (!sampleRow) {
      return [];
    }

    return Object.keys(sampleRow).map((key) => {
      const value = sampleRow[key];
      const type = this.detectType(value);

      return {
        key,
        label: this.formatLabel(key),
        type,
      };
    });
  }

  /**
   * Détecte le type d'une valeur
   */
  private detectType(value: any): 'text' | 'number' | 'currency' | 'date' | 'boolean' {
    if (typeof value === 'boolean') {
      return 'boolean';
    }

    if (typeof value === 'number') {
      return 'number';
    }

    if (typeof value === 'string') {
      // Vérifier si c'est une date
      if (this.isDate(value)) {
        return 'date';
      }

      // Vérifier si c'est une monnaie
      if (this.isCurrency(value)) {
        return 'currency';
      }

      // Vérifier si c'est un nombre
      if (!isNaN(Number(value.replace(/,/g, '')))) {
        return 'number';
      }
    }

    return 'text';
  }

  /**
   * Vérifie si une string est une date
   */
  private isDate(value: string): boolean {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  /**
   * Vérifie si une string est une monnaie
   */
  private isCurrency(value: string): boolean {
    const currencyPattern = /^[\$€£¥]?\s?[\d,]+\.?\d*$/;
    return currencyPattern.test(value.trim());
  }

  /**
   * Formate un nom de clé en label lisible
   */
  private formatLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Sauvegarde les données importées dans widget_data
   */
  async saveImportedData(widgetId: string, importedData: ImportedData) {
    try {
      const { error } = await supabase
        .from('widget_data')
        .upsert({
          widget_id: widgetId,
          data: {
            rows: importedData.rows,
            columns: importedData.columns,
          },
          metadata: importedData.metadata,
        });

      if (error) {
        throw error;
      }

      console.log('[DataImport] Data saved successfully for widget:', widgetId);
    } catch (error: any) {
      throw new Error(`Erreur sauvegarde données: ${error.message}`);
    }
  }
}

export const dataImportService = new DataImportService();
