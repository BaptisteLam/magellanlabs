# Configuration OAuth Google et Apple pour Supabase

Ce guide explique comment configurer l'authentification Google et Apple pour votre projet Magellan Studio.

## Prérequis

- Accès au dashboard Supabase de votre projet
- Compte Google Cloud Console (pour Google OAuth)
- Compte Apple Developer (pour Apple Sign In)

---

## 1. Configuration Google OAuth

### Étape 1: Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API "Google+ API" ou "Google Identity"

### Étape 2: Configurer l'écran de consentement OAuth

1. Dans le menu latéral, allez dans **APIs & Services** > **OAuth consent screen**
2. Choisissez **External** pour permettre à tous les utilisateurs de se connecter
3. Remplissez les informations requises:
   - **App name**: Magellan Studio
   - **User support email**: votre email
   - **App logo**: (optionnel)
   - **App domain**: votre domaine (ex: magellanstudio.com)
   - **Developer contact information**: votre email

4. Cliquez sur **Save and Continue**
5. Dans **Scopes**, ajoutez:
   - `email`
   - `profile`
   - `openid`

### Étape 3: Créer les credentials OAuth

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **OAuth client ID**
3. Choisissez **Web application**
4. Configurez:
   - **Name**: Magellan Studio Web Client
   - **Authorized JavaScript origins**:
     ```
     https://votre-projet.supabase.co
     http://localhost:5173
     https://votre-domaine.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://votre-projet.supabase.co/auth/v1/callback
     ```
5. Cliquez sur **Create**
6. **Copiez le Client ID et Client Secret**

### Étape 4: Configurer Supabase

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Authentication** > **Providers**
4. Cliquez sur **Google**
5. Activez le provider et entrez:
   - **Client ID**: (celui copié à l'étape 3)
   - **Client Secret**: (celui copié à l'étape 3)
6. Cliquez sur **Save**

---

## 2. Configuration Apple Sign In

### Prérequis

- Compte Apple Developer ($99/an)
- L'App ID doit avoir "Sign In with Apple" activé

### Étape 1: Créer un App ID

1. Allez sur [Apple Developer Portal](https://developer.apple.com/)
2. Connectez-vous et allez dans **Certificates, Identifiers & Profiles**
3. Cliquez sur **Identifiers** > **+**
4. Sélectionnez **App IDs** > **Continue**
5. Sélectionnez **App** > **Continue**
6. Configurez:
   - **Description**: Magellan Studio
   - **Bundle ID**: com.magellanstudio.web (explicit)
7. Cochez **Sign In with Apple** dans les capabilities
8. Cliquez sur **Continue** > **Register**

### Étape 2: Créer un Services ID

1. Dans **Identifiers**, cliquez sur **+**
2. Sélectionnez **Services IDs** > **Continue**
3. Configurez:
   - **Description**: Magellan Studio Web
   - **Identifier**: com.magellanstudio.web.service
4. Cliquez sur **Continue** > **Register**
5. Cliquez sur le Services ID créé
6. Cochez **Sign In with Apple**
7. Cliquez sur **Configure** à côté de Sign In with Apple
8. Configurez:
   - **Primary App ID**: Sélectionnez l'App ID créé à l'étape 1
   - **Domains and Subdomains**:
     ```
     votre-projet.supabase.co
     ```
   - **Return URLs**:
     ```
     https://votre-projet.supabase.co/auth/v1/callback
     ```
9. Cliquez sur **Save** > **Continue** > **Save**

### Étape 3: Créer une clé privée

1. Allez dans **Keys** > **+**
2. Configurez:
   - **Key Name**: Magellan Studio Sign In
   - Cochez **Sign In with Apple**
3. Cliquez sur **Configure** > sélectionnez votre App ID
4. Cliquez sur **Continue** > **Register**
5. **Téléchargez la clé** (fichier .p8) - vous ne pourrez le télécharger qu'une seule fois!
6. **Notez le Key ID**

### Étape 4: Configurer Supabase

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Authentication** > **Providers**
4. Cliquez sur **Apple**
5. Activez le provider et entrez:
   - **Services ID**: com.magellanstudio.web.service (celui créé à l'étape 2)
   - **Team ID**: Trouvez-le dans le coin supérieur droit de l'Apple Developer Portal (ex: ABC123DEF)
   - **Key ID**: (celui noté à l'étape 3)
   - **Private Key**: Copiez tout le contenu du fichier .p8 téléchargé
6. Cliquez sur **Save**

---

## 3. Configuration des URLs de redirection

### Dans Supabase

1. Allez dans **Authentication** > **URL Configuration**
2. Configurez:
   - **Site URL**: `https://votre-domaine.com`
   - **Redirect URLs** (ajoutez toutes ces URLs):
     ```
     https://votre-domaine.com/auth
     https://votre-domaine.com/
     http://localhost:5173/auth
     http://localhost:5173/
     ```

### Variables d'environnement

Assurez-vous que votre `.env` contient:

```env
VITE_SUPABASE_URL="https://votre-projet.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="votre-clé-anon"
```

---

## 4. Test de l'authentification

### En développement local

1. Lancez votre app: `npm run dev`
2. Allez sur `http://localhost:5173/auth`
3. Cliquez sur "Continuer avec Google" ou "Continuer avec Apple"
4. Vous devriez être redirigé vers la page de connexion du provider
5. Après connexion, vous serez redirigé vers votre app

### Debugging

Si l'authentification ne fonctionne pas:

1. **Vérifiez la console du navigateur** pour les erreurs
2. **Vérifiez les logs Supabase** dans le dashboard > Logs
3. **Erreurs courantes**:
   - `provider is not enabled`: Le provider n'est pas activé dans Supabase
   - `redirect_uri_mismatch`: L'URL de redirection n'est pas configurée dans Google/Apple
   - `invalid_client`: Les credentials sont incorrects

---

## 5. Production

Avant de passer en production:

1. **Google**: Vérifiez votre app dans l'écran de consentement OAuth (peut prendre quelques jours)
2. **Apple**: Assurez-vous que le domaine de production est configuré
3. **Supabase**: Mettez à jour les Redirect URLs avec les URLs de production

---

## Support

- [Documentation Supabase Auth](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Sign In with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
