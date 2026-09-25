# GitHub and Vercel Deployment

This repository is deployed as one Vercel project and one Render service:

- Frontend: `frontend/earth-app` (Vite static site)
- Backend: `backend` (FastAPI service on Render)

The backend loads TensorFlow models at startup. It cannot be deployed as a
Vercel Python function because the dependency bundle is larger than Vercel's
500 MB function limit. Render is used for the backend because it supports a
normal Python process and the model files.

## 1. Push the repository to GitHub

From the repository root:

```bash
git init
git add .
git commit -m "Prepare Suraksha for deployment"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repository>.git
git push -u origin main
```

Do not commit real `.env` files or credentials. The checked-in
`frontend/earth-app/.env.example` and `backend/.env.example` are templates.

## 2. Deploy the backend on Render

1. Open Render and choose **New > Web Service**.
2. Connect the `Kundhan0/Suraksha` GitHub repository.
3. Set **Root Directory** to `backend`.
4. Set **Runtime** to `Python 3`.
5. Set **Build Command** to `pip install -r requirements.txt`.
6. Set **Start Command** to:

   ```bash
   uvicorn src.api:app --host 0.0.0.0 --port $PORT
   ```

7. In **Environment Variables**, add:

   - `FRONTEND_URL` = `https://<frontend-project>.vercel.app`
   - `SKIP_PRECOMPUTE` = `true`

8. Deploy and test `https://<render-service>.onrender.com/health`.

The repository includes `render.yaml` with the same service configuration.

## 3. Deploy the frontend on Vercel

1. Create another Vercel project from the same GitHub repository.
2. Set **Root Directory** to `frontend/earth-app`.
3. Set the environment variable:

   - `VITE_API_URL` = `https://<render-service>.onrender.com`

4. Deploy.
5. Test the frontend URL and confirm the browser can call `/health` and
   `/api/villages/ranking`.

The frontend build output is `dist`, and SPA fallback routing is in
`frontend/earth-app/vercel.json`.

## 4. Lock CORS to the deployed frontend

Copy the final frontend URL and update the backend Render variable:

```text
FRONTEND_URL=https://<frontend-project>.vercel.app
```

Redeploy the Render service after changing this variable. For local
development, use the comma-separated value from `backend/.env.example`.

## Local verification

```bash
cd frontend/earth-app
npm install
npm run build

cd ../../backend
python -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload
```

For a local frontend `.env.local`, use:

```text
VITE_API_URL=http://localhost:8001
```