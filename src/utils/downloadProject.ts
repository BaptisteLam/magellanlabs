import JSZip from 'jszip';

export const downloadProjectAsZip = async () => {
  const zip = new JSZip();

  // Liste des fichiers à inclure dans le ZIP
  const files = [
    { path: 'index.html', url: '/index.html' },
    { path: 'robots.txt', url: '/robots.txt' },
    { path: 'sitemap.xml', url: '/sitemap.xml' },
    { path: 'package.json', url: '/package.json' },
    { path: 'tsconfig.json', url: '/tsconfig.json' },
    { path: 'vite.config.ts', url: '/vite.config.ts' },
    { path: 'tailwind.config.ts', url: '/tailwind.config.ts' },
    { path: 'README.md', url: '/README.md' },
  ];

  // Récupérer les fichiers sources
  const sourceFiles = import.meta.glob('/src/**/*', { as: 'raw', eager: true });
  
  for (const [path, content] of Object.entries(sourceFiles)) {
    const relativePath = path.replace('/src/', 'src/');
    zip.file(relativePath, content as string);
  }

  // Récupérer les fichiers publics
  const publicFiles = import.meta.glob('/public/**/*', { as: 'raw', eager: true });
  
  for (const [path, content] of Object.entries(publicFiles)) {
    const relativePath = path.replace('/public/', 'public/');
    zip.file(relativePath, content as string);
  }

  // Ajouter les fichiers racine
  for (const file of files) {
    try {
      const response = await fetch(file.url);
      if (response.ok) {
        const content = await response.text();
        zip.file(file.path, content);
      }
    } catch (error) {
      console.warn(`Impossible de récupérer ${file.path}:`, error);
    }
  }

  // Générer le ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Créer un lien de téléchargement
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trinity-ai-project-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
