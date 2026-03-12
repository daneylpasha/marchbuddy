# CI/CD Setup Guide — March Buddy

This guide walks you through the one-time manual steps needed to activate the automated CI/CD pipeline.

You need to add **3 secrets** to your GitHub repository. Here's how to get each one.

---

## Step 1: Create EXPO_TOKEN

This lets GitHub Actions authenticate with your Expo account.

1. Go to [https://expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
2. Click **"Create Token"**
3. Name it `github-actions` (or anything descriptive)
4. Copy the token immediately (you won't see it again)
5. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
6. Click **"New repository secret"**
7. Name: `EXPO_TOKEN`
8. Value: paste the token
9. Click **"Add secret"**

---

## Step 2: Create GOOGLE_SERVICE_ACCOUNT_KEY

This lets EAS Submit upload builds to your Google Play Console.

### If you already have the JSON key file (`marchbuddy-a1ae5b97bf28.json`):

1. Open your terminal and run:
   ```bash
   base64 -i marchbuddy-a1ae5b97bf28.json | pbcopy
   ```
   (This copies the base64-encoded content to your clipboard. On Linux, use `base64 marchbuddy-a1ae5b97bf28.json | xclip -selection clipboard`)

2. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
5. Value: paste the base64 string
6. Click **"Add secret"**

### If you need to create a new service account key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one linked to your Play Console)
3. Go to **IAM & Admin** → **Service Accounts**
4. Click **"Create Service Account"**
5. Name it `eas-submit` and click **"Create and Continue"**
6. Skip the role selection for now → click **"Done"**
7. Click on the newly created service account email
8. Go to the **"Keys"** tab → **"Add Key"** → **"Create new key"**
9. Select **JSON** → **"Create"** (downloads the JSON file)
10. Now link it to Play Console:
    - Go to [Google Play Console](https://play.google.com/console) → **Setup** → **API access**
    - Click **"Link"** next to the Google Cloud project
    - Under **Service accounts**, find your new account and click **"Grant access"**
    - Under **App permissions**, select **March Buddy**
    - Under **Account permissions**, enable: **Release to production, exclude devices, and use Play App Signing**
    - Click **"Invite user"** → **"Send invite"**
11. Now base64-encode and add to GitHub (same as step 1 above)

---

## Step 3: Create SLACK_WEBHOOK_URL

This sends build notifications to your Slack channel.

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Name it `March Buddy CI/CD`, select your workspace
4. In the left sidebar, click **"Incoming Webhooks"**
5. Toggle **"Activate Incoming Webhooks"** to ON
6. Click **"Add New Webhook to Workspace"**
7. Select the channel where you want notifications (e.g., `#deployments`)
8. Copy the webhook URL
9. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
10. Click **"New repository secret"**
11. Name: `SLACK_WEBHOOK_URL`
12. Value: paste the webhook URL
13. Click **"Add secret"**

---

## Step 4: Install dev dependencies (run this locally)

```bash
npm install --save-dev eslint eslint-config-expo eslint-config-prettier eslint-plugin-prettier prettier jest jest-expo @types/jest
```

---

## How the Pipeline Works

### On every Pull Request to `main`:
**Workflow: `pr-quality-gate.yml`**
- Runs ESLint → TypeScript check → Jest tests
- PR cannot merge if any step fails

### On push to `main` (JS-only changes):
**Workflow: `ota-update.yml`**
- Detects that no native files changed
- Runs `eas update` to push an OTA update instantly
- Users get the update without downloading from Play Store
- Slack notification sent

### On push to `main` (native file changes) OR manual trigger:
**Workflow: `build-and-submit.yml`**
- Builds the Android app via EAS Build (cloud)
- Auto-increments `versionCode`
- Submits the `.aab` to Google Play Console's **internal testing** track
- Slack notifications at each stage

### Manual trigger for production release:
1. Go to GitHub repo → **Actions** → **"Build & Submit to Play Store"**
2. Click **"Run workflow"**
3. Select `production` from the track dropdown
4. This builds AND submits directly to the production track

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `.github/workflows/pr-quality-gate.yml` | Lint + typecheck + test on PRs |
| `.github/workflows/ota-update.yml` | OTA updates for JS-only changes |
| `.github/workflows/build-and-submit.yml` | Native build + Play Store submit |
| `.eslintrc.js` | ESLint configuration |
| `.prettierrc` | Code formatting rules |
| `jest.config.js` | Jest test runner config |
| `jest.setup.js` | Test mocks for RN/Expo modules |
| `eas.json` | Updated submit config for CI |
| `package.json` | Added lint/test/typecheck scripts |

---

## GitHub Secrets Summary

| Secret Name | Where to Get It |
|-------------|-----------------|
| `EXPO_TOKEN` | expo.dev → Settings → Access Tokens |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64 of your Google Service Account JSON |
| `SLACK_WEBHOOK_URL` | Slack API → Your App → Incoming Webhooks |
