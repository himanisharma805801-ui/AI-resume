# AI Resume Roaster — React + Node.js on AWS EC2

A small full-stack resume feedback app designed to follow the deployment architecture in the supplied PDF:
- React + Vite frontend (`frontend/`, production output `dist/`)
- Node.js + Express backend (`backend/src/server.js`)
- MongoDB Atlas persistence
- Nginx serves React and proxies `/api/` requests to Express on `127.0.0.1:5000`
- PM2 keeps the backend running
- Optional Gemini API integration for AI-generated feedback
- No Docker required

## 1. Local prerequisites
- Node.js 20.x and npm
- A MongoDB Atlas database (recommended for full functionality)
- Optional Gemini API key for AI feedback

## 2. Configure the backend
```bash
cd backend
cp .env.example .env
nano .env
```
Set `MONGODB_URI` to your Atlas connection string and replace `JWT_SECRET` with a long random secret. `GEMINI_API_KEY` is optional. Never commit `.env`.

## 3. Run locally
Terminal 1:
```bash
cd backend
npm install
npm start
```
Terminal 2:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL printed in the terminal. For local development, the frontend's Vite proxy sends `/api` requests to `http://localhost:5000`.

## 4. GitHub
Create an empty repository on GitHub, then from this project folder:
```bash
git init
git add .
git commit -m "Initial full-stack AI Resume Roaster"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-resume-roaster.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your GitHub username. Do not commit `.env`, credentials, private keys, or Atlas connection strings.

## 5. Deploy to Ubuntu 24.04 EC2
See `DEPLOY-EC2.md` for the complete PDF-aligned walkthrough.

## API endpoints
Because the Nginx configuration in `DEPLOY-EC2.md` strips the `/api/` prefix:
- `GET /api/health` (Nginx maps this to backend `GET /health`)
- `POST /api/reviews` (Nginx maps this to backend `POST /reviews`)
- `GET /api/reviews` (Nginx maps this to backend `GET /reviews`)

## Important
- The backend listens on port 5000 and binds to `127.0.0.1` by default.
- Only expose SSH (22) to your own IP, and HTTP (80) publicly. Add HTTPS (443) when configuring TLS.
- In MongoDB Atlas Network Access, allow the EC2 instance's current public IP. Avoid `0.0.0.0/0` in production.
- The Gemini integration is optional; without a key the app returns a simple heuristic review.
