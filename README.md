# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/bd69d0ff-8787-4ab6-be94-536fb7e5ee8b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/bd69d0ff-8787-4ab6-be94-536fb7e5ee8b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Automatic Deployment (via Lovable)

Simply open [Lovable](https://lovable.dev/projects/bd69d0ff-8787-4ab6-be94-536fb7e5ee8b) and click on Share -> Publish. Your project will be automatically deployed to Cloudflare Pages.

### Manual Deployment to Cloudflare Pages

**Prerequisites:**
- Install [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Have a Cloudflare account with Pages enabled

**Deploy via CLI:**
```sh
# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=your-project-name
```

**Deploy via API (used by Lovable):**
The project includes an edge function at `supabase/functions/deploy-to-cloudflare/index.ts` that handles automatic deployments to Cloudflare Pages via their REST API.

**Configuration:**
The deployment requires the following environment variables (configured in Supabase secrets):
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Pages write permissions
- `GA_MEASUREMENT_ID` (optional) - Google Analytics tracking ID

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
