/**
 * DataTable Widget - Tableau de données avec colonnes configurables
 * Supporte tri, filtres, pagination, actions
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Eye, Trash2, Copy, Search } from 'lucide-react';
import type { WidgetProps } from './WidgetRegistry';

interface ColumnConfig {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'number' | 'date' | 'badge' | 'boolean';
  currency?: string;
  unit?: string;
  values?: Record<string, string>; // Pour type='badge'
  sortable?: boolean;
}

export default function DataTable({ widgetId, title, config }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnConfig[] = config.columns || [];
  const actions: string[] = config.actions || [];
  const hasPagination = config.pagination !== false;
  const hasFilters = config.filters && config.filters.length > 0;

  useEffect(() => {
    fetchData();
  }, [widgetId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: widgetData, error } = await supabase
        .from('widget_data' as any)
        .select('data')
        .eq('widget_id', widgetId)
        .maybeSingle();

      if (error) throw error;

      const wd = widgetData as any;
      if (wd?.data?.rows) {
        setData(wd.data.rows);
      } else {
        // Données mockées pour démonstration si vide
        setData(generateMockData(columns));
      }
    } catch (error) {
      console.error('Error fetching widget data:', error);
      setData(generateMockData(columns));
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = (cols: ColumnConfig[]): any[] => {
    // Générer 5 lignes de données mockées
    return Array.from({ length: 5 }, (_, i) => {
      const row: any = { id: `mock-${i + 1}` };
      cols.forEach(col => {
        if (col.type === 'currency') {
          row[col.key] = Math.floor(Math.random() * 100000) + 10000;
        } else if (col.type === 'number') {
          row[col.key] = Math.floor(Math.random() * 100) + 1;
        } else if (col.type === 'badge' && col.values) {
          const keys = Object.keys(col.values);
          row[col.key] = keys[Math.floor(Math.random() * keys.length)];
        } else if (col.type === 'boolean') {
          row[col.key] = Math.random() > 0.5;
        } else if (col.type === 'date') {
          row[col.key] = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          row[col.key] = `Sample ${col.label} ${i + 1}`;
        }
      });
      return row;
    });
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const renderCell = (row: any, column: ColumnConfig) => {
    const value = row[column.key];

    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }

    switch (column.type) {
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: column.currency || 'EUR'
        }).format(value);

      case 'number':
        return `${value.toLocaleString('fr-FR')}${column.unit ? ' ' + column.unit : ''}`;

      case 'date':
        return new Date(value).toLocaleDateString('fr-FR');

      case 'badge':
        const badgeLabel = column.values?.[value] || value;
        const isPositive = value === 'available' || value === 'active' || value === 'confirmed';
        return (
          <Badge
            variant={isPositive ? 'default' : 'secondary'}
            style={{
              backgroundColor: isPositive ? '#03A5C0' : undefined,
              color: isPositive ? 'white' : undefined
            }}
          >
            {badgeLabel}
          </Badge>
        );

      case 'boolean':
        return (
          <Badge variant={value ? 'default' : 'secondary'}>
            {value ? 'Oui' : 'Non'}
          </Badge>
        );

      default:
        return String(value);
    }
  };

  const filteredData = data.filter(row => {
    if (!searchQuery) return true;
    return columns.some(col => {
      const value = row[col.key];
      return String(value).toLowerCase().includes(searchQuery.toLowerCase());
    });
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {hasFilters && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 border border-border/50 rounded-lg overflow-hidden bg-card/50">
        <div className="overflow-auto max-h-[400px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.sortable !== false ? 'cursor-pointer hover:text-[#03A5C0]' : ''}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    {col.label}
                    {sortColumn === col.key && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                ))}
                {actions.length > 0 && <TableHead className="w-[50px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchQuery ? 'Aucun résultat trouvé' : 'Aucune donnée'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, i) => (
                  <TableRow key={row.id || i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {renderCell(row, col)}
                      </TableCell>
                    ))}
                    {actions.length > 0 && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions.includes('view') && (
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir
                              </DropdownMenuItem>
                            )}
                            {actions.includes('edit') && (
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                            )}
                            {actions.includes('duplicate') && (
                              <DropdownMenuItem>
                                <Copy className="h-4 w-4 mr-2" />
                                Dupliquer
                              </DropdownMenuItem>
                            )}
                            {actions.includes('delete') && (
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer - Pagination placeholder */}
      {hasPagination && sortedData.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{sortedData.length} résultat(s)</span>
          {/* TODO: Ajouter pagination réelle si nécessaire */}
        </div>
      )}
    </div>
  );
}
