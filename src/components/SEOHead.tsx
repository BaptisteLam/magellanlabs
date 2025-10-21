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
  keywords = "agence web, création site internet, développement web, SEO, Trinity Studio",
  canonicalUrl,
  ogImage = "/lovable-uploads/e3c54182-b806-4948-8c03-e14452931ed7.png",
  structuredData 
}: SEOHeadProps) => {
  // Put Trinity Studio first for better SEO visibility
  const fullTitle = title.includes('Trinity Studio') ? title : `Trinity Studio | ${title}`;
  const currentUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Trinity Studio" />
      {currentUrl && <link rel="canonical" href={currentUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {currentUrl && <meta property="og:url" content={currentUrl} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Trinity Studio" />
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