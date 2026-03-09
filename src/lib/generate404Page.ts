/**
 * Generates a styled 404 page for display in the preview
 * Used when a user navigates to a non-existent page
 * Completely isolated from the Magellan SaaS - navigation only within the preview
 */
export function generate404Page(isDark: boolean = false): string {
  const logoUrl = isDark 
    ? '/assets/magellan-logo-dark.png'
    : '/assets/magellan-logo-light.png';
    
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found - Magellan</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: ${isDark ? '#0a0a0a' : '#ffffff'};
      color: ${isDark ? '#e5e5e5' : '#1a1a1a'};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    
    .container {
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    
    .error-code {
      font-size: 8rem;
      font-weight: 400;
      line-height: 1;
      background: linear-gradient(135deg, #03A5C0 0%, #0284a8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
      animation: fadeInUp 0.6s ease-out 0.1s both;
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: ${isDark ? '#ffffff' : '#000000'};
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }
    
    p {
      font-size: 12px;
      color: ${isDark ? '#a3a3a3' : '#666666'};
      margin-bottom: 2rem;
      line-height: 1.6;
      animation: fadeInUp 0.6s ease-out 0.3s both;
    }
    
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0 1.5rem;
      height: auto;
      background: rgba(3, 165, 192, 0.1);
      border: 1px solid rgb(3, 165, 192);
      color: rgb(3, 165, 192);
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      animation: fadeInUp 0.6s ease-out 0.4s both;
    }
    
    .button:hover {
      background: rgba(3, 165, 192, 0.15);
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-code">404</div>
    <h1>Page Not Found</h1>
    <p>The page you are looking for does not exist or has not yet been created in this project.</p>
    <button class="button" onclick="navigateToHome(event)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      Back to home
    </button>
  </div>
  
  <script>
    (function() {
      console.log('🏠 404 Page - Navigation script loaded');
      
      // Navigation isolated within the preview only - return to index.html
      window.navigateToHome = function(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        
        console.log('🏠 Returning to preview home (index.html)');
        
        // Send message to parent to load index.html in the preview
        window.parent.postMessage({
          type: 'navigate',
          file: 'index.html'
        }, '*');
        
        return false;
      };
      
      console.log('✅ 404 - Navigation button configured');
    })();
  </script>
</body>
</html>`;
}
