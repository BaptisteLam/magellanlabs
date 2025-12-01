import { Helmet } from 'react-helmet';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  structuredData?: object;
}

const SEOHead = ({ 
  title, 
  description, 
  keywords = "agence web, création site internet, développement web, SEO, Magellan Studio",
  canonicalUrl,
  ogImage = "/lovable-uploads/magellan-logo-light.png",
  structuredData 
}: SEOHeadProps) => {
  // Use title as-is if it already contains Magellan, otherwise add it
  const fullTitle = title.includes('Magellan') ? title : `Magellan | ${title}`;
  const currentUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Magellan" />
      {currentUrl && <link rel="canonical" href={currentUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {currentUrl && <meta property="og:url" content={currentUrl} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Magellan" />
      <meta property="og:locale" content="fr_FR" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;