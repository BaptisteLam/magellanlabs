import { Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
import PromptBar from '@/components/PromptBar';
import TemplateCard from '@/components/TemplateCard';

// Import template images
import agenceImg from '@/assets/templates/agence.jpeg';
import centreActiviteImg from '@/assets/templates/centre-activite.jpeg';
import immobilierImg from '@/assets/templates/immobilier.jpeg';
import pagePersoImg from '@/assets/templates/page-perso.jpeg';
import webinaireImg from '@/assets/templates/webinaire.jpeg';
import mariageImg from '@/assets/templates/mariage.jpeg';
import logicielImg from '@/assets/templates/logiciel.jpeg';
import restaurantImg from '@/assets/templates/restaurant.jpeg';
import hotelImg from '@/assets/templates/hotel.jpeg';
import systemeNumeriqueImg from '@/assets/templates/systeme-numerique.jpeg';
interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const [projectType, setProjectType] = useState<'website' | 'webapp' | 'mobile'>('website');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleFileSelect = async (files: File[]) => {
    const newFiles: Array<{ name: string; base64: string; type: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith('image/')) {
        sonnerToast.error(`${file.name} n'est pas une image`);
        continue;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      newFiles.push({ name: file.name, base64, type: file.type });
    }

    setAttachedFiles([...attachedFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      sonnerToast.error("Veuillez entrer votre message");
      return;
    }

    if (!user) {
      localStorage.setItem('redirectAfterAuth', '/');
      sonnerToast.info("Connectez-vous pour générer votre site");
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    try {
      const prompt = inputValue.trim();

      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: user.id,
          title: null,
          project_files: [],
          project_type: projectType,
          messages: [{ role: 'user', content: prompt }]
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error('Erreur lors de la création de la session');
      }

      setInputValue('');
      setAttachedFiles([]);
      
      navigate(`/builder/${session.id}`, { 
        state: { attachedFiles } 
      });
    } catch (error) {
      console.error('Erreur:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const templates = [
    {
      title: "Agence Marketing",
      description: "Landing page professionnelle pour agence de marketing digital avec services et portfolio.",
      imageUrl: agenceImg,
      messagesSaved: 15
    },
    {
      title: "Centre de Fitness",
      description: "Site complet pour salle de sport avec abonnements, équipements et planning des cours.",
      imageUrl: centreActiviteImg,
      messagesSaved: 18
    },
    {
      title: "Agence Immobilière",
      description: "Plateforme immobilière élégante avec listings de propriétés et estimations.",
      imageUrl: immobilierImg,
      messagesSaved: 20
    },
    {
      title: "Page Personnelle",
      description: "Portfolio professionnel pour consultant ou freelance avec parcours et services.",
      imageUrl: pagePersoImg,
      messagesSaved: 12
    },
    {
      title: "Webinaire & Formation",
      description: "Landing page de conversion pour webinaire avec inscription et témoignages.",
      imageUrl: webinaireImg,
      messagesSaved: 14
    },
    {
      title: "Mariage & Événement",
      description: "Site élégant pour mariage avec galerie photos, programme et RSVP.",
      imageUrl: mariageImg,
      messagesSaved: 16
    },
    {
      title: "Logiciel SaaS",
      description: "Landing page moderne pour produit SaaS avec fonctionnalités et pricing.",
      imageUrl: logicielImg,
      messagesSaved: 22
    },
    {
      title: "Restaurant",
      description: "Site gastronomique avec menu, réservations et ambiance culinaire.",
      imageUrl: restaurantImg,
      messagesSaved: 17
    },
    {
      title: "Hôtel & Hébergement",
      description: "Site hôtelier de luxe avec chambres, services et réservation en ligne.",
      imageUrl: hotelImg,
      messagesSaved: 19
    },
    {
      title: "Produit Numérique",
      description: "Page de vente pour cours en ligne ou produit digital avec témoignages.",
      imageUrl: systemeNumeriqueImg,
      messagesSaved: 21
    }
  ];

  const handleTemplateView = (template: typeof templates[0]) => {
    sonnerToast.info(`Aperçu du template "${template.title}"`);
  };

  const handleTemplateUse = (template: typeof templates[0]) => {
    setInputValue(`Crée un site web pour ${template.title.toLowerCase()} : ${template.description}`);
    sonnerToast.success(`Template "${template.title}" sélectionné`);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center overflow-hidden pt-20" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff' }}>
      {/* Grid background */}
      <div className="absolute inset-0" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px'
           }} 
      />
      {/* Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[200px] left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
        <div className="absolute top-[100px] right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slower" 
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.3)' }} />
        <div className="absolute top-[50px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        <div className="absolute top-0 right-1/3 w-[700px] h-[700px] rounded-full blur-[140px] animate-pulse-slow" 
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.25)' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-4 text-center mt-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#4cc9f0] bg-transparent mb-6 leading-none cursor-pointer backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-[#4cc9f0]" />
          <span className="text-sm font-light text-[#4cc9f0]">Chat avec Magellan</span>
        </div>

        {/* Main title */}
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className={`text-lg md:text-xl font-light mb-10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* AI Input Area */}
        <div className="max-w-2xl mx-auto">
          <PromptBar
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            showPlaceholderAnimation={true}
            attachedFiles={attachedFiles}
            onRemoveFile={removeFile}
            onFileSelect={handleFileSelect}
            projectType={projectType}
            onProjectTypeChange={setProjectType}
          />
        </div>
      </div>

      {/* Templates Gallery */}
      <div className="relative z-10 w-full max-w-7xl px-4 mt-32 mb-16">
        {/* Section Header */}
        <div className="mb-8 text-center">
          <h2 
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: isDark ? 'hsl(var(--foreground))' : '#1e293b' }}
          >
            Templates populaires
          </h2>
          <p 
            className="text-base"
            style={{ color: isDark ? 'hsl(var(--muted-foreground))' : '#64748b' }}
          >
            Commence avec un template et personnalise-le en quelques clics
          </p>
        </div>

        {/* Templates Grid - 3 columns responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, index) => (
            <TemplateCard
              key={index}
              title={template.title}
              description={template.description}
              imageUrl={template.imageUrl}
              messagesSaved={template.messagesSaved}
              onView={() => handleTemplateView(template)}
              onUse={() => handleTemplateUse(template)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AISearchHero;
