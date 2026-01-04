/**
 * Composant de fond quadrillé pour le CRM
 * Préserve l'identité visuelle Magellan avec le cyan
 */

import { cn } from '@/lib/utils';

interface GridBackgroundProps {
  children: React.ReactNode;
  className?: string;
  gridSize?: number;
  gridColor?: string;
  gridOpacity?: number;
}

export function GridBackground({
  children,
  className,
  gridSize = 24,
  gridColor = 'rgba(6, 182, 212, 0.04)', // Cyan Magellan
  gridOpacity = 1,
}: GridBackgroundProps) {
  return (
    <div
      className={cn('relative min-h-screen bg-[#1C1D1F]', className)}
      style={{
        backgroundImage: `
          linear-gradient(${gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        opacity: gridOpacity,
      }}
    >
      {/* Gradient overlay pour effet de profondeur */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(28, 29, 31, 0.8) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
