import { useEffect, useState, useRef } from 'react';
import { Loader } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ExpoSnackPreviewProps {
  files: Record<string, string>;
  isDark?: boolean;
}

export const ExpoSnackPreview = ({ files, isDark = false }: ExpoSnackPreviewProps) => {
  const [snackId, setSnackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackUrl, setSnackUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const createSnack = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Convertir les fichiers en format Expo Snack
        const snackFiles: Record<string, { type: string; contents: string }> = {};
        
        // Si on a des fichiers HTML/CSS/JS, les convertir en App.js React Native
        if (files['index.html'] || files['App.tsx'] || files['App.jsx']) {
          // Générer un fichier App.js React Native basique
          const appCode = files['App.tsx'] || files['App.jsx'] || generateReactNativeFromHtml(files['index.html'] || '');
          snackFiles['App.js'] = {
            type: 'CODE',
            contents: appCode
          };
        } else {
          // Parcourir tous les fichiers et les ajouter
          Object.entries(files).forEach(([path, content]) => {
            snackFiles[path] = {
              type: 'CODE',
              contents: content
            };
          });
        }

        // Créer un Snack via l'API Expo
        const response = await fetch('https://snack.expo.dev/--/api/v2/snacks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Magellan Mobile App',
            description: 'Application mobile créée avec Magellan Studio',
            files: snackFiles,
            dependencies: {
              'expo': '*',
              'react': '*',
              'react-native': '*',
              'react-native-web': '*'
            }
          }),
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la création du Snack');
        }

        const data = await response.json();
        const newSnackId = data.id;
        setSnackId(newSnackId);
        
        const url = `https://snack.expo.dev/@snack/${newSnackId}`;
        setSnackUrl(url);
        
        console.log('✅ Snack créé:', url);
      } catch (err) {
        console.error('Erreur création Snack:', err);
        setError('Impossible de créer la preview mobile');
      } finally {
        setIsLoading(false);
      }
    };

    if (Object.keys(files).length > 0) {
      createSnack();
    }
  }, [files]);

  const generateReactNativeFromHtml = (html: string): string => {
    // Conversion basique HTML vers React Native
    return `import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Application Mobile</Text>
        <Text style={styles.text}>
          Votre application est en cours de développement.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
});`;
  };

  if (isLoading) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8F9FA' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin" style={{ color: '#03A5C0' }} />
          <p style={{ color: isDark ? '#E2E8F0' : '#475569' }}>
            Création de la preview mobile...
          </p>
        </div>
      </div>
    );
  }

  if (error || !snackId) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: isDark ? '#0A0A0A' : '#F8F9FA' }}
      >
        <div className="text-center">
          <p style={{ color: isDark ? '#EF4444' : '#DC2626', marginBottom: 8 }}>
            {error || 'Erreur de chargement'}
          </p>
          <p style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 14 }}>
            Veuillez réessayer
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Preview Expo Snack */}
      <iframe
        ref={iframeRef}
        src={`https://snack.expo.dev/embedded/@snack/${snackId}?platform=ios&preview=true&theme=${isDark ? 'dark' : 'light'}`}
        className="w-full h-full border-0"
        allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; usb"
        sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
      />
      
      {/* QR Code à droite */}
      <div 
        className="absolute right-4 top-4 p-4 rounded-lg shadow-lg"
        style={{
          backgroundColor: isDark ? '#1F1F20' : '#FFFFFF',
          borderWidth: 1,
          borderColor: isDark ? '#2A2A2B' : '#E2E8F0',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <p 
            className="text-xs font-medium text-center"
            style={{ color: isDark ? '#E2E8F0' : '#475569' }}
          >
            Scanner pour tester
          </p>
          <div className="p-2 bg-white rounded">
            <QRCodeSVG 
              value={snackUrl}
              size={120}
              level="M"
              includeMargin={false}
            />
          </div>
          <p 
            className="text-xs text-center"
            style={{ color: isDark ? '#94A3B8' : '#64748B' }}
          >
            Expo Go
          </p>
        </div>
      </div>
    </div>
  );
};
