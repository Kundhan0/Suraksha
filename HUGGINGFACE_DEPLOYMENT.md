# Hugging Face Spaces Note

The current Hugging Face Spaces UI requires a paid plan for Docker and Gradio
Spaces. Static Spaces are free, but they cannot run this FastAPI/TensorFlow
backend. Do not select the Static option for the API.

For a free-tier backend alternative, use Google Cloud Run as documented below.

## Google Cloud Run

Cloud Run has a free monthly usage tier, but Google requires a billing account.
You can set a maximum instance count and budget alert to control usage.

1. Install the Google Cloud CLI and run `gcloud auth login`.
2. Create or select a Google Cloud project with billing enabled.
3. From the repository root, run:

  ```bash
  gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/suraksha-api
  gcloud run deploy suraksha-api `
    --image gcr.io/YOUR_PROJECT_ID/suraksha-api `
    --region us-central1 `
    --platform managed `
    --allow-unauthenticated `
    --memory 2Gi `
    --cpu 2 `
    --max-instances 1 `
    --set-env-vars SKIP_PRECOMPUTE=true,FRONTEND_URL=https://YOUR_FRONTEND.vercel.app
  ```

  In PowerShell, use backticks as shown for line continuation, or put the
  deploy command on one line.

4. Copy the Cloud Run URL and set this Vercel variable:

  ```text
  VITE_API_URL=https://your-cloud-run-url
  ```

5. Redeploy the frontend, then update `FRONTEND_URL` on Cloud Run with the
  final Vercel URL.

Cloud Run may charge for usage above its free tier. Set a Google Cloud budget
alert and keep `--max-instances 1` enabled.

## Previous Spaces Instructions

This project includes a root `Dockerfile` for running the FastAPI and
TensorFlow backend as a Docker Space. The frontend can remain on Vercel.

## Create the Space

1. Sign in at https://huggingface.co.
2. Select **New Space**.
3. Choose a name such as `suraksha-api`.
4. Set visibility to **Public** or **Private**.
5. Select **Docker** as the Space SDK.
6. Choose the free CPU hardware option.
7. Create the Space.

## Push this repository to the Space

From the local project root, replace the placeholders with your Hugging Face
username and Space name:

```bash
git remote add hf https://huggingface.co/spaces/<HF_USERNAME>/suraksha-api
git push hf main
```

If the Space already has an initial README commit, use:

```bash
git pull hf main --allow-unrelated-histories
git push hf main
```

The root `Dockerfile` installs the backend dependencies and starts FastAPI on
the port expected by Spaces (`7860`).

## Add Space variables

In the Space, open **Settings > Variables and secrets** and add:

```text
FRONTEND_URL=https://<frontend-project>.vercel.app
SKIP_PRECOMPUTE=true
```

Wait for the Space to finish building, then test:

```text
https://<HF_USERNAME>-suraksha-api.hf.space/health
```

The exact hostname shown by Hugging Face is authoritative.

## Connect the Vercel frontend

In Vercel, open the frontend project and add this environment variable:

```text
VITE_API_URL=https://<HF_SPACE_HOSTNAME>
```

Redeploy the frontend after saving the variable. Then update the Hugging Face
`FRONTEND_URL` variable with the final Vercel URL and restart the Space.

## Important limitations

- Free Spaces can sleep when unused, so the first request may be slow.
- Free hardware limits and availability can change; confirm the selected
  hardware in the Space settings.
- Chat history is not durable storage in this application. Use a database if
  persistent chat history is required.