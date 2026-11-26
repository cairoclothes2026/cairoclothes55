# Cloudflare Pages Deployment Guide

## Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `cairo-clothes-web`
3. Visibility: Public  
4. Do NOT initialize (leave unselected)
5. Click "Create repository"

## Step 2: Upload Files to GitHub

### Option A: GitHub Desktop (Recommended)
1. Install GitHub Desktop from: https://desktop.github.com
2. File → Clone Repository → Add → Choose local repository
3. Navigate to `C:\Users\dell\.codex\.chatgpt-projects\g-p-6ade40fb83f88191a89c8f905cd18d50\cairo-clothes-web`
4. Click "Add as Local Repository"
5. Click "Publish Repository"

### Option B: PowerShell (if Git is installed)
```powershell
# Open PowerShell as Administrator and install Git first:
winget install Git.Git

# Then run:
git clone https://github.com/YOUR_USERNAME/cairo-clothes-web.git
cd cairo-clothes-web
xcopy "C:\Users\dell\.codex\.chatgpt-projects\g-p-6ade40fb83f88191a89c8f905cd18d50\cairo-clothes-web\*" . /E /H /C /I
git add .
git commit -m "Initial commit - Cairo Clothes Platform"
git push origin main
```

## Step 3: Deploy to Cloudflare Pages
1. Go to https://dash.cloudflare.com
2. Click "Pages" in left sidebar
3. Click "Create a project"
4. Select your GitHub repository
5. Settings:
   - Framework preset: **Next.js**
   - Build command: `npm install && npm run build`
   - Build directory: `.next`

## Step 4: Environment Variables (for production)
In Cloudflare → Pages → Your site → Settings → Environment variables:

| Key | Value |
|-----|-------|
| NEXT_PUBLIC_SITE_URL | https://your-domain.pages.dev |

## Done! 
Every push to main branch will auto-deploy.