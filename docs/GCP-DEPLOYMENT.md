# LicenseIQ - Google Cloud Deployment Guide

This guide helps you put your LicenseIQ app on the internet using Google Cloud. Your database stays the same (Neon) - we're just moving where the app runs.

---

## Before You Start

**What you'll need:**
- A Google account (Gmail works)
- A credit card for Google Cloud (they give $300 free credit for new users)
- About 30-60 minutes

**What this costs:**
- First 90 days: FREE (Google gives $300 credit)
- After that: Around $5-50/month depending on usage

---

## OPTION 1: Deploy Using Google Cloud Website (Easiest)

This option uses the Google Cloud website - no coding required.

### Step 1: Create a Google Cloud Account

1. Go to **https://cloud.google.com**
2. Click **"Get started for free"** or **"Console"** (top right)
3. Sign in with your Google account
4. Enter your billing information (you won't be charged - it's for verification)
5. You'll get **$300 free credit** for 90 days

### Step 2: Create a New Project

1. In the Google Cloud Console, click the project dropdown at the top (says "Select a project")
2. Click **"New Project"**
3. Name it: `licenseiq-production`
4. Click **"Create"**
5. Wait 30 seconds, then select your new project from the dropdown

### Step 3: Enable Cloud Run

1. In the search bar at the top, type **"Cloud Run"**
2. Click on **"Cloud Run"** in the results
3. If prompted, click **"Enable API"** and wait

### Step 4: Download Your App Code

You need to get your code from Replit to upload to Google:

1. In Replit, click the three dots menu (⋮) next to "Files"
2. Click **"Download as zip"**
3. Save the zip file to your computer
4. Unzip it to a folder

### Step 5: Deploy to Cloud Run

1. Go back to **Cloud Run** in Google Cloud Console
2. Click **"Create Service"**
3. Select **"Continuously deploy from a repository"** → Click **"Set up with Cloud Build"**
   - OR select **"Deploy one revision from an existing container image"** if you have Docker

**Easier Alternative - Use Cloud Shell:**

1. Click the **Cloud Shell** icon (terminal icon) at the top right of Google Cloud Console
2. A terminal opens at the bottom of your screen
3. Upload your zip file:
   - Click the three dots (⋮) in Cloud Shell
   - Click **"Upload"**
   - Select your zip file
4. In Cloud Shell, type these commands one by one:

```
unzip your-file-name.zip
cd your-folder-name
```

5. Now deploy:

```
gcloud run deploy licenseiq --source . --region us-central1 --allow-unauthenticated --port 5000
```

6. When asked questions, press Enter to accept defaults
7. Wait 5-10 minutes for deployment
8. You'll get a URL like: `https://licenseiq-xxxxx-uc.a.run.app`

### Step 6: Add Your Secret Keys

Your app needs the database connection and API keys:

1. In Google Cloud Console, search for **"Secret Manager"**
2. Click **"Enable API"** if prompted
3. Click **"Create Secret"**
4. Create these secrets one by one:

| Secret Name | What to Put | Where to Find It |
|-------------|-------------|------------------|
| `DATABASE_URL` | Your Neon database URL | Replit Secrets tab |
| `GROQ_API_KEY` | Your Groq API key | Replit Secrets tab |
| `HUGGINGFACE_API_KEY` | Your HuggingFace key | Replit Secrets tab |
| `SESSION_SECRET` | Any random text (like `my-super-secret-key-12345`) | Make one up |

For each secret:
1. Click **"Create Secret"**
2. Enter the name (e.g., `DATABASE_URL`)
3. Paste the value
4. Click **"Create"**

### Step 7: Connect Secrets to Your App

1. Go back to **Cloud Run**
2. Click on your service name (`licenseiq`)
3. Click **"Edit & Deploy New Revision"**
4. Scroll down to **"Variables & Secrets"** tab
5. Click **"Reference a Secret"**
6. For each secret:
   - Select the secret name
   - Set "Exposed as" to **Environment Variable**
   - Set the variable name (same as secret name)
7. Click **"Deploy"**

### Step 8: Test Your App

1. Click the URL at the top of your Cloud Run service
2. Your app should load!
3. Try logging in with your usual credentials

---

## OPTION 2: Deploy Using Command Line

For users comfortable with terminal/command line.

### Step 1: Install Google Cloud CLI

**On Windows:**
1. Download from: https://cloud.google.com/sdk/docs/install
2. Run the installer
3. Open Command Prompt or PowerShell

**On Mac:**
```bash
brew install google-cloud-sdk
```

**On Linux:**
```bash
curl https://sdk.cloud.google.com | bash
```

### Step 2: Login and Setup

Open your terminal and run:

```bash
# Login to Google Cloud (opens browser)
gcloud auth login

# Create a new project
gcloud projects create licenseiq-prod --name="LicenseIQ"

# Use this project
gcloud config set project licenseiq-prod

# Enable billing (required)
# Go to: https://console.cloud.google.com/billing
# Link your project to a billing account

# Enable the services we need
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 3: Add Your Secret Keys

Run these commands, replacing the values with your actual keys from Replit:

```bash
# Database connection (get from Replit Secrets)
echo -n "postgresql://user:pass@host/db" | gcloud secrets create DATABASE_URL --data-file=-

# Groq API key
echo -n "gsk_your_groq_key_here" | gcloud secrets create GROQ_API_KEY --data-file=-

# HuggingFace key
echo -n "hf_your_key_here" | gcloud secrets create HUGGINGFACE_API_KEY --data-file=-

# Session secret (make up a random string)
echo -n "my-super-secret-session-key-12345" | gcloud secrets create SESSION_SECRET --data-file=-
```

### Step 4: Deploy Your App

Navigate to your project folder and run:

```bash
gcloud run deploy licenseiq \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 5000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,GROQ_API_KEY=GROQ_API_KEY:latest,HUGGINGFACE_API_KEY=HUGGINGFACE_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest"
```

Wait 5-10 minutes. When done, you'll see your app URL.

### Step 5: Test It

Open the URL in your browser. Your app should work!

---

## Updating Your App Later

When you make changes and want to update the live app:

**Using Website:**
1. Download new zip from Replit
2. Go to Cloud Run → Your service → Edit & Deploy
3. Upload new code

**Using Command Line:**
```bash
gcloud run deploy licenseiq --source . --region us-central1
```

---

## Troubleshooting

### "App won't load"
- Check Cloud Run → Your service → Logs
- Make sure all secrets are connected
- Verify DATABASE_URL is correct

### "Can't login"
- Check SESSION_SECRET is set
- Check DATABASE_URL connects to your Neon database

### "AI features don't work"
- Check GROQ_API_KEY is set correctly
- Check HUGGINGFACE_API_KEY is set

### Need Help?
- Google Cloud Support: https://cloud.google.com/support
- View logs: Cloud Run → Your service → Logs tab

---

## Cost Control Tips

1. **Set budget alerts:**
   - Go to Billing → Budgets & alerts
   - Create a budget for $20/month
   - Get email when you hit 50%, 90%, 100%

2. **Min instances = 0:**
   - Already set - app sleeps when not used
   - You only pay when someone uses it

3. **Delete if not needed:**
   - Cloud Run → Select service → Delete

---

## Quick Reference

| What | Where to Find It |
|------|------------------|
| Your app URL | Cloud Run → Your service → Top of page |
| Logs | Cloud Run → Your service → Logs tab |
| Secrets | Secret Manager |
| Billing | Billing → Overview |
| Stop the app | Cloud Run → Your service → Delete |

---

## Summary

1. ✅ Create Google Cloud account (free $300 credit)
2. ✅ Create project called `licenseiq-production`
3. ✅ Enable Cloud Run
4. ✅ Upload your code
5. ✅ Add secrets (DATABASE_URL, GROQ_API_KEY, etc.)
6. ✅ Deploy and get your URL
7. ✅ Test your app!

**Your Neon database stays exactly the same - it's already on the internet. We're just moving where the app code runs.**
