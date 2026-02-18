import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from '@/stores/themeStore';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Globe, Eye, BarChart3, Pencil, Copy, ExternalLink, Crown, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from '@/hooks/useTranslation';
import { useCredits } from '@/hooks/useCredits';

interface ProjectData {
  id: string;
  title: string | null;
  project_type: string | null;
  created_at: string;
  updated_at: string;
  public_url: string | null;
  cloudflare_deployment_url: string | null;
  cloudflare_project_name: string | null;
  thumbnail_url: string | null;
}

interface CustomDomainData {
  id: string;
  domain: string;
  status: string;
  dns_verified: boolean;
}

type DnsStatus = 'idle' | 'checking' | 'connected' | 'partial' | 'not_connected';

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { isDark } = useThemeStore();
  const { language } = useTranslation();
  const isFr = language === 'fr';
  const { canAddDomain } = useCredits();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Custom domain state
  const [customDomain, setCustomDomain] = useState<CustomDomainData | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>('idle');
  const [showDnsTutorial, setShowDnsTutorial] = useState(false);
  const [dnsDetails, setDnsDetails] = useState<{ apexConfigured: boolean; wwwConfigured: boolean } | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchCustomDomain();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from('build_sessions')
        .select('id, title, project_type, created_at, updated_at, public_url, cloudflare_deployment_url, cloudflare_project_name, thumbnail_url')
        .eq('id', projectId)
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        variant: 'destructive',
        title: isFr ? 'Erreur' : 'Error',
        description: isFr ? 'Impossible de charger le projet' : 'Unable to load project',
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomDomain = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_domains')
        .select('id, domain, status, dns_verified')
        .eq('session_id', projectId)
        .maybeSingle();

      if (!error && data) {
        setCustomDomain(data);
        // Auto-check DNS status for existing domain
        checkDnsStatus(data.domain);
      }
    } catch {
      // No custom domain yet
    }
  };

  const checkDnsStatus = useCallback(async (domain: string) => {
    setDnsStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('domain-connect-verify', {
        body: { domain, sessionId: projectId }
      });

      if (error) throw error;

      setDnsDetails({
        apexConfigured: data?.apexConfigured || false,
        wwwConfigured: data?.wwwConfigured || false,
      });

      if (data?.configured) {
        setDnsStatus('connected');
      } else if (data?.apexConfigured || data?.wwwConfigured) {
        setDnsStatus('partial');
      } else {
        setDnsStatus('not_connected');
      }
    } catch {
      setDnsStatus('not_connected');
      setDnsDetails(null);
    }
  }, [projectId]);

  const handleAddDomain = async () => {
    const cleanDomain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanDomain || !cleanDomain.includes('.')) {
      toast({ variant: 'destructive', title: isFr ? 'Domaine invalide' : 'Invalid domain', description: isFr ? 'Entrez un nom de domaine valide (ex: monsite.com)' : 'Enter a valid domain name (e.g. mysite.com)' });
      return;
    }

    setIsAddingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-custom-domain', {
        body: {
          domain: cleanDomain,
          sessionId: projectId,
          cloudflareProjectName: project?.cloudflare_project_name,
        }
      });

      if (error) throw error;

      // Save to custom_domains table
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('custom_domains').upsert({
          user_id: session.user.id,
          session_id: projectId,
          domain: cleanDomain,
          cloudflare_project_name: project?.cloudflare_project_name || '',
          status: 'pending',
          dns_verified: false,
          method: 'manual',
        }, { onConflict: 'session_id' });
      }

      setCustomDomain({ id: '', domain: cleanDomain, status: 'pending', dns_verified: false });
      setDomainInput('');
      setShowDnsTutorial(true);
      setDnsStatus('not_connected');
      toast({ title: isFr ? 'Domaine ajouté' : 'Domain added', description: isFr ? 'Configurez vos DNS selon les instructions ci-dessous.' : 'Configure your DNS according to the instructions below.' });
    } catch (error: any) {
      console.error('Error adding domain:', error);
      toast({ variant: 'destructive', title: isFr ? 'Erreur' : 'Error', description: error.message || (isFr ? "Impossible d'ajouter le domaine" : 'Unable to add domain') });
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!customDomain) return;
    try {
      await supabase.from('custom_domains').delete().eq('session_id', projectId);
      setCustomDomain(null);
      setDnsStatus('idle');
      setDnsDetails(null);
      setShowDnsTutorial(false);
      toast({ title: isFr ? 'Domaine supprimé' : 'Domain removed' });
    } catch {
      toast({ variant: 'destructive', title: isFr ? 'Erreur' : 'Error' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: isFr ? 'Copié !' : 'Copied!' });
  };

  const handleEditProject = () => {
    if (project?.project_type === 'webapp') {
      navigate(`/builder-app/${projectId}`);
    } else {
      navigate(`/builder/${projectId}`);
    }
  };

  const handleViewLive = () => {
    if (project?.public_url) {
      window.open(project.public_url, '_blank');
    } else if (project?.cloudflare_deployment_url) {
      window.open(project.cloudflare_deployment_url, '_blank');
    } else {
      toast({
        title: isFr ? 'Projet non publié' : 'Project not published',
        description: isFr ? "Ce projet n'a pas encore été publié." : 'This project has not been published yet.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-muted-foreground">{isFr ? 'Chargement...' : 'Loading...'}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{isFr ? 'Projet introuvable' : 'Project not found'}</p>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }}
          >
            {isFr ? 'Retour au tableau de bord' : 'Back to dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  const cnameTarget = 'proxy.builtbymagellan.com';
  const aRecordIP = '185.158.133.1';

  return (
    <div className="min-h-screen w-full relative">
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(rgba(3, 165, 192, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(3, 165, 192, 0.03) 1px, transparent 1px)'
            : 'linear-gradient(rgba(3, 165, 192, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(3, 165, 192, 0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="hover:text-[#03A5C0]"
            aria-label={isFr ? 'Retour au tableau de bord' : 'Back to dashboard'}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {project.title || (isFr ? 'Sans titre' : 'Untitled')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFr ? 'Créé le' : 'Created on'} {new Date(project.created_at).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Button onClick={handleEditProject} className="h-24 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }} variant="outline">
            <Pencil className="h-6 w-6" />
            <span>{isFr ? 'Modifier le projet' : 'Edit project'}</span>
          </Button>
          <Button onClick={handleViewLive} className="h-24 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }} variant="outline">
            <Eye className="h-6 w-6" />
            <span>{isFr ? 'Voir en ligne' : 'View live'}</span>
          </Button>
          <Button onClick={() => navigate(`/preview/${projectId}`)} className="h-24 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }} variant="outline">
            <Globe className="h-6 w-6" />
            <span>{isFr ? 'Prévisualiser' : 'Preview'}</span>
          </Button>
          <Button onClick={() => toast({ title: isFr ? 'Bientôt disponible' : 'Coming soon', description: isFr ? 'Les analytics seront disponibles prochainement.' : 'Analytics will be available soon.' })} className="h-24 flex flex-col items-center justify-center gap-2" style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }} variant="outline">
            <BarChart3 className="h-6 w-6" />
            <span>Analytics</span>
          </Button>
        </div>

        {/* Published URL section */}
        {project.public_url && (
          <div className="mb-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" style={{ color: '#03A5C0' }} />
              {isFr ? 'URL publique' : 'Public URL'}
            </h2>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
              <span className="text-sm font-mono text-foreground truncate flex-1">{project.public_url}</span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={() => copyToClipboard(project.public_url!)}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={() => window.open(project.public_url!, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Custom Domain section */}
        <div className="mb-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: '#03A5C0' }} />
            {isFr ? 'Nom de domaine personnalisé' : 'Custom domain'}
            {!canAddDomain && (
              <span className="inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(3,165,192,0.1)', color: '#03A5C0' }}>
                <Crown className="h-3 w-3" /> Premium
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isFr
              ? 'Connectez votre propre nom de domaine à ce projet.'
              : 'Connect your own domain name to this project.'}
          </p>

          {!canAddDomain ? (
            /* Free user - Premium upsell */
            <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(3,165,192,0.08) 0%, rgba(3,165,192,0.03) 100%)', border: '1px solid rgba(3,165,192,0.15)' }}>
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 flex-shrink-0" style={{ color: '#03A5C0' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {isFr ? 'Fonctionnalité Premium' : 'Premium feature'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isFr
                      ? 'Passez en Premium pour connecter votre propre nom de domaine.'
                      : 'Upgrade to Premium to connect your own domain name.'}
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/pricing')}
                  className="rounded-full text-white text-sm"
                  style={{ backgroundColor: '#03A5C0' }}
                >
                  {isFr ? 'Passer en Premium' : 'Upgrade'}
                </Button>
              </div>
            </div>
          ) : !project.public_url ? (
            /* Site not published yet */
            <div className="rounded-xl p-4 border border-border/50 bg-muted/20">
              <p className="text-sm text-muted-foreground">
                {isFr
                  ? 'Publiez votre site avant de connecter un nom de domaine.'
                  : 'Publish your site before connecting a custom domain.'}
              </p>
            </div>
          ) : customDomain ? (
            /* Domain exists - show status */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                {/* Status indicator */}
                {dnsStatus === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground flex-shrink-0" />}
                {dnsStatus === 'connected' && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
                {dnsStatus === 'partial' && <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                {dnsStatus === 'not_connected' && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                {dnsStatus === 'idle' && <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{customDomain.domain}</p>
                  <p className="text-xs text-muted-foreground">
                    {dnsStatus === 'checking' && (isFr ? 'Vérification DNS...' : 'Checking DNS...')}
                    {dnsStatus === 'connected' && (isFr ? 'DNS connecté' : 'DNS connected')}
                    {dnsStatus === 'partial' && (isFr ? 'DNS partiellement configuré' : 'DNS partially configured')}
                    {dnsStatus === 'not_connected' && (isFr ? 'DNS non connecté' : 'DNS not connected')}
                    {dnsStatus === 'idle' && (isFr ? 'En attente de vérification' : 'Waiting for verification')}
                  </p>
                </div>

                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => checkDnsStatus(customDomain.domain)}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {/* DNS details for partial */}
              {dnsStatus === 'partial' && dnsDetails && (
                <div className="text-xs space-y-1 px-3">
                  <div className="flex items-center gap-2">
                    {dnsDetails.apexConfigured ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    <span className="text-muted-foreground">A record (@) → {aRecordIP}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dnsDetails.wwwConfigured ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    <span className="text-muted-foreground">CNAME (www) → {cnameTarget}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => setShowDnsTutorial(!showDnsTutorial)}
                  style={{ borderColor: 'rgba(3,165,192,0.3)', color: '#03A5C0' }}
                >
                  {showDnsTutorial
                    ? (isFr ? 'Masquer les instructions' : 'Hide instructions')
                    : (isFr ? 'Voir les instructions DNS' : 'View DNS instructions')
                  }
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs text-muted-foreground hover:text-red-500"
                  onClick={handleRemoveDomain}
                >
                  {isFr ? 'Supprimer' : 'Remove'}
                </Button>
              </div>

              {/* DNS Tutorial */}
              {showDnsTutorial && (
                <DnsTutorial
                  domain={customDomain.domain}
                  cnameTarget={cnameTarget}
                  aRecordIP={aRecordIP}
                  isFr={isFr}
                  isDark={isDark}
                  copyToClipboard={copyToClipboard}
                />
              )}
            </div>
          ) : (
            /* No domain yet - show input */
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder={isFr ? 'monsite.com' : 'mysite.com'}
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddDomain}
                  disabled={isAddingDomain || !domainInput.trim()}
                  className="rounded-full text-white"
                  style={{ backgroundColor: '#03A5C0' }}
                >
                  {isAddingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : (isFr ? 'Connecter' : 'Connect')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="mb-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{isFr ? 'Aperçu' : 'Preview'}</h2>
          {project.thumbnail_url ? (
            <img src={project.thumbnail_url} alt={project.title || (isFr ? 'Aperçu' : 'Preview')} className="w-full max-w-2xl rounded-lg border border-border/50" />
          ) : (
            <div className="w-full max-w-2xl h-48 bg-muted/30 rounded-lg border border-border/50 flex items-center justify-center">
              <span className="text-muted-foreground">{isFr ? 'Aucun aperçu disponible' : 'No preview available'}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{isFr ? 'Informations' : 'Information'}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 text-foreground">{project.project_type === 'webapp' ? (isFr ? 'Application Web' : 'Web App') : (isFr ? 'Site Web' : 'Website')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{isFr ? 'Dernière modification:' : 'Last modified:'}</span>
              <span className="ml-2 text-foreground">{new Date(project.updated_at).toLocaleDateString(isFr ? 'fr-FR' : 'en-US')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* DNS Tutorial Component */
function DnsTutorial({ domain, cnameTarget, aRecordIP, isFr, isDark, copyToClipboard }: {
  domain: string;
  cnameTarget: string;
  aRecordIP: string;
  isFr: boolean;
  isDark: boolean;
  copyToClipboard: (text: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 p-5 space-y-5" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {isFr ? 'Comment connecter votre domaine' : 'How to connect your domain'}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {isFr
            ? "Rendez-vous dans les paramètres DNS de votre registrar (OVH, Namecheap, GoDaddy, Ionos, Cloudflare...) et ajoutez les enregistrements suivants :"
            : "Go to the DNS settings of your registrar (OVH, Namecheap, GoDaddy, Ionos, Cloudflare...) and add the following records:"}
        </p>
      </div>

      {/* Step 1: A record */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#03A5C0' }}>1</span>
          <span className="text-sm font-medium text-foreground">
            {isFr ? 'Enregistrement A (domaine racine)' : 'A Record (root domain)'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded border border-border/50 bg-muted/20">
            <span className="text-muted-foreground block mb-1">Type</span>
            <span className="font-mono text-foreground">A</span>
          </div>
          <div className="p-2 rounded border border-border/50 bg-muted/20">
            <span className="text-muted-foreground block mb-1">{isFr ? 'Nom' : 'Name'}</span>
            <span className="font-mono text-foreground">@</span>
          </div>
          <div className="p-2 rounded border border-border/50 bg-muted/20 cursor-pointer hover:border-[#03A5C0]/50" onClick={() => copyToClipboard(aRecordIP)}>
            <span className="text-muted-foreground block mb-1">{isFr ? 'Valeur' : 'Value'}</span>
            <span className="font-mono text-foreground flex items-center gap-1">{aRecordIP} <Copy className="h-3 w-3 opacity-50" /></span>
          </div>
        </div>
      </div>

      {/* Step 2: CNAME record */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#03A5C0' }}>2</span>
          <span className="text-sm font-medium text-foreground">
            {isFr ? 'Enregistrement CNAME (www)' : 'CNAME Record (www)'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded border border-border/50 bg-muted/20">
            <span className="text-muted-foreground block mb-1">Type</span>
            <span className="font-mono text-foreground">CNAME</span>
          </div>
          <div className="p-2 rounded border border-border/50 bg-muted/20">
            <span className="text-muted-foreground block mb-1">{isFr ? 'Nom' : 'Name'}</span>
            <span className="font-mono text-foreground">www</span>
          </div>
          <div className="p-2 rounded border border-border/50 bg-muted/20 cursor-pointer hover:border-[#03A5C0]/50" onClick={() => copyToClipboard(cnameTarget)}>
            <span className="text-muted-foreground block mb-1">{isFr ? 'Valeur' : 'Value'}</span>
            <span className="font-mono text-foreground flex items-center gap-1 break-all">{cnameTarget} <Copy className="h-3 w-3 opacity-50 flex-shrink-0" /></span>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#03A5C0' }}>3</span>
          <span className="text-sm font-medium text-foreground">
            {isFr ? 'Attendez la propagation DNS' : 'Wait for DNS propagation'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-7">
          {isFr
            ? "La propagation DNS peut prendre de quelques minutes à 48 heures. Cliquez sur le bouton d'actualisation pour vérifier le statut."
            : "DNS propagation can take from a few minutes to 48 hours. Click the refresh button to check the status."}
        </p>
      </div>

      {/* Tips */}
      <div className="rounded-lg p-3 text-xs space-y-1" style={{ backgroundColor: 'rgba(3,165,192,0.06)', border: '1px solid rgba(3,165,192,0.12)' }}>
        <p className="font-medium" style={{ color: '#03A5C0' }}>{isFr ? 'Conseils :' : 'Tips:'}</p>
        <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
          <li>{isFr ? "Si vous utilisez Cloudflare, désactivez le proxy (icône nuage orange → gris) pour les enregistrements ci-dessus." : "If you're using Cloudflare, disable the proxy (orange cloud icon → grey) for the records above."}</li>
          <li>{isFr ? "Supprimez tout enregistrement A ou CNAME existant pour @ et www avant d'ajouter les nouveaux." : "Delete any existing A or CNAME records for @ and www before adding the new ones."}</li>
          <li>{isFr ? 'Le TTL recommandé est de 3600 (1 heure) ou Auto.' : 'The recommended TTL is 3600 (1 hour) or Auto.'}</li>
        </ul>
      </div>
    </div>
  );
}
