import { BarChart3 } from "lucide-react";

interface AnalyticsProps {
  isPublished: boolean;
  isDark: boolean;
}

export default function Analytics({ isPublished, isDark }: AnalyticsProps) {
  if (!isPublished) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            <BarChart3 className="w-8 h-8 text-[#03A5C0]" />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
            Analytics non disponibles
          </h3>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Pour voir vos analytics, il faut publier votre site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <div className={`rounded-lg border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
          Analytics
        </h2>
        {/* Contenu analytics à venir */}
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Données analytics à venir...
        </p>
      </div>
    </div>
  );
}
