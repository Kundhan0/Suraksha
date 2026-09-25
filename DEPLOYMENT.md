# GitHub and Vercel Deployment

This repository is deployed as two Vercel projects:

- Frontend: `frontend/earth-app` (Vite static site)
- Backend: `backend` (FastAPI Python function)

The backend loads TensorFlow models at startup. Vercel may reject the Python
bundle or time out on cold starts because of runtime size and serverless
execution limits. If that happens, deploy the backend on Render or Railway and
keep the frontend on Vercel; the same `VITE_API_URL` configuration applies.

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

## 2. Deploy the backend on Vercel

1. Open Vercel and choose **Add New > Project**.
2. Import the GitHub repository.
3. Set **Root Directory** to `backend`.
4. Keep the detected Python configuration and deploy.
5. In **Settings > Environment Variables**, add:

   - `FRONTEND_URL` = `http://localhost:5173` temporarily
   - `SKIP_PRECOMPUTE` = `true`

6. Redeploy after adding the variables.
7. Test `https://<backend-project>.vercel.app/health`.

The backend entrypoint is `backend/api/index.py`, and its Vercel routing is in
`backend/vercel.json`.

## 3. Deploy the frontend on Vercel

1. Create another Vercel project from the same GitHub repository.
2. Set **Root Directory** to `frontend/earth-app`.
3. Set the environment variable:

   - `VITE_API_URL` = `https://<backend-project>.vercel.app`

4. Deploy.
5. Test the frontend URL and confirm the browser can call `/health` and
   `/api/villages/ranking`.

The frontend build output is `dist`, and SPA fallback routing is in
`frontend/earth-app/vercel.json`.

## 4. Lock CORS to the deployed frontend

Copy the final frontend URL and update the backend Vercel variable:

```text
FRONTEND_URL=https://<frontend-project>.vercel.app
```

For local development, use the comma-separated value from
`backend/.env.example`. Redeploy the backend after changing this variable.

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