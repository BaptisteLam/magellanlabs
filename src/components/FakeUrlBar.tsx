import { Lock } from 'lucide-react';

interface FakeUrlBarProps {
  projectTitle: string;
  isDark?: boolean;
}

export function FakeUrlBar({ projectTitle, isDark = false }: FakeUrlBarProps) {
  // Convertir le titre en nom de domaine
  const domainName = projectTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
    .replace(/[^a-z0-9\s-]/g, '') // Retirer les caractères spéciaux
    .trim()
    .replace(/\s+/g, '-') // Remplacer espaces par tirets
    .replace(/-+/g, '-') // Éviter tirets multiples
    || 'monsite';

  return (
    <div 
      className="h-10 border-b flex items-center px-4 gap-3"
      style={{ 
        backgroundColor: isDark ? '#2A2A2B' : '#F8F9FA',
        borderBottomColor: isDark ? '#3A3A3B' : '#E5E7EB'
      }}
    >
      {/* Boutons de navigation */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isDark ? '#4A4A4B' : '#E5E7EB' }}
          />
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isDark ? '#4A4A4B' : '#E5E7EB' }}
          />
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isDark ? '#4A4A4B' : '#E5E7EB' }}
          />
        </div>
      </div>

      {/* Barre d'URL */}
      <div 
        className="flex-1 h-7 rounded-md px-3 flex items-center gap-2"
        style={{ 
          backgroundColor: isDark ? '#1F1F20' : '#FFFFFF',
          border: `1px solid ${isDark ? '#3A3A3B' : '#E5E7EB'}`
        }}
      >
        <Lock 
          className="w-3.5 h-3.5" 
          style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
        />
        <span 
          className="text-sm font-medium"
          style={{ color: isDark ? '#E5E7EB' : '#1F2937' }}
        >
          {domainName}.com
        </span>
      </div>

      {/* Icône options */}
      <div 
        className="w-6 h-6 rounded flex items-center justify-center"
        style={{ backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB' }}
      >
        <div className="flex flex-col gap-0.5">
          <div 
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: isDark ? '#6B7280' : '#9CA3AF' }}
          />
          <div 
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: isDark ? '#6B7280' : '#9CA3AF' }}
          />
          <div 
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: isDark ? '#6B7280' : '#9CA3AF' }}
          />
        </div>
      </div>
    </div>
  );
}
