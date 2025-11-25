import html2canvas from 'html2canvas';

/**
 * Capture un thumbnail de la preview HTML sans utiliser d'API externe
 * Crée un conteneur invisible, y injecte le HTML, capture avec html2canvas
 * @param htmlContent Le contenu HTML complet à capturer
 * @returns Un Blob de l'image PNG ou null en cas d'erreur
 */
export async function capturePreviewThumbnail(htmlContent: string): Promise<Blob | null> {
  try {
    console.log('📸 Début de la capture de thumbnail...');
    
    // Créer un conteneur invisible hors de la vue
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 1200px;
      height: 630px;
      overflow: hidden;
      background: white;
      z-index: -1;
    `;
    
    // Injecter le HTML complet
    container.innerHTML = htmlContent;
    document.body.appendChild(container);
    console.log('✅ Conteneur créé et HTML injecté');
    
    // Attendre que le contenu soit rendu
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capturer avec html2canvas
    console.log('📸 Capture avec html2canvas...');
    const canvas = await html2canvas(container, {
      width: 1200,
      height: 630,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    
    console.log('✅ Canvas créé:', canvas.width, 'x', canvas.height);
    
    // Nettoyer le DOM
    document.body.removeChild(container);
    console.log('🗑️ Conteneur nettoyé');
    
    // Convertir en blob PNG
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          console.log('✅ Blob créé:', blob.size, 'octets');
        } else {
          console.error('❌ Échec de création du blob');
        }
        resolve(blob);
      }, 'image/png', 0.9);
    });
  } catch (error) {
    console.error('❌ Erreur lors de la capture du thumbnail:', error);
    return null;
  }
}
