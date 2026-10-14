# Step-by-step EC2 deployment (matches the supplied PDF)

This guide deploys the React frontend and Express API on one Ubuntu EC2 instance. Nginx listens on port 80, PM2 manages Node.js on port 5000, and MongoDB Atlas is the cloud database.

## Phase 1 — Launch and prepare EC2

### 1. Launch the instance
In AWS Console → EC2 → Launch instance:
- Name: `ai-resume-roaster`
- AMI: Ubuntu Server 24.04 LTS
- Instance type: a small instance suitable for learning (check current AWS pricing)
- Create/download a key pair and keep the `.pem` file private.
- Security group inbound rules:
  - SSH TCP 22: **your current public IP only**
  - HTTP TCP 80: `0.0.0.0/0` (and `::/0` if using IPv6)
  - HTTPS TCP 443: optional now; needed for HTTPS later
- Do not open port 5000 to the internet; Nginx will reach it locally.

### 2. Connect from your computer
Run from the folder containing your key (Linux/macOS/WSL):
```bash
chmod 400 key.pem
ssh -i key.pem ubuntu@EC2_PUBLIC_IP
```
Replace `key.pem` and `EC2_PUBLIC_IP` with your actual values. On Windows, use a compatible SSH terminal and ensure the private key ACLs are restricted.

### 3. Install Nginx, Git, and Node.js 20
Run on the EC2 instance:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx git curl -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
node -v
npm -v
git --version
sudo systemctl enable nginx
sudo systemctl start nginx
```
Confirm Node reports version 20.x.

### 4. Clone the GitHub repository
Replace the URL with your own repository:
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/ai-resume-roaster.git
cd ai-resume-roaster
ls
```
Expected folders include `frontend/` and `backend/`.

## Phase 2 — Build and deploy the React frontend

### 5. Install frontend dependencies and build
```bash
cd ~/ai-resume-roaster/frontend
npm install
npm run build
ls dist
```
Vite should create the production build in `frontend/dist/`.

### 6. Copy the build to Nginx's web root
```bash
sudo mkdir -p /var/www/html
sudo find /var/www/html -mindepth 1 -maxdepth 1 -exec rm -rf {} +
sudo cp -r dist/. /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```
Do not run the delete command against any directory other than `/var/www/html`.

## Phase 3 — Configure and start the backend

### 7. Configure environment variables
```bash
cd ~/ai-resume-roaster/backend
npm install
cp .env.example .env
nano .env
```
Set these values:
```dotenv
PORT=5000
HOST=127.0.0.1
MONGODB_URI=mongodb+srv://DB_USER:DB_PASSWORD@YOUR_CLUSTER.mongodb.net/resume_roaster?retryWrites=true&w=majority
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
GEMINI_API_KEY=
```
Replace the example MongoDB URI with the connection string from your Atlas cluster. URL-encode special characters in the database username/password as needed. Keep `.env` private and never paste secrets into GitHub.

Generate a random secret on the EC2 instance if desired:
```bash
openssl rand -hex 32
```
Copy the output into `JWT_SECRET`. This starter project reserves that variable for future authentication; it does not implement login/JWT authentication.

### 8. Configure MongoDB Atlas Network Access
In MongoDB Atlas:
1. Open your project and cluster.
2. Go to **Security → Network Access**.
3. Add the EC2 instance's current public IPv4 address as a `/32` entry.
4. Under **Database Access**, create a database user and password.
5. Get the connection string from **Connect → Drivers** and put it in `MONGODB_URI`.
6. Use the database name `resume_roaster` in the URI, or update the URI to your preferred database.

Atlas access can fail if the EC2 public IP changes; update the allowlist when that happens. Do not use `0.0.0.0/0` for production.

### 9. Test the backend manually
```bash
cd ~/ai-resume-roaster/backend
npm start
```
In another SSH terminal, test:
```bash
curl http://127.0.0.1:5000/health
```
Expected JSON includes `"ok":true`. If MongoDB is configured and reachable, the response reports the database connection state as connected. Stop the manual server with `Ctrl+C` before using PM2.

### 10. Start backend with PM2
```bash
sudo npm install -g pm2
cd ~/ai-resume-roaster/backend
pm2 start src/server.js --name resume-backend
pm2 status
pm2 logs resume-backend
pm2 save
pm2 startup
```
**Important:** `pm2 startup` prints a command beginning with `sudo env ...`. Copy and run the exact command PM2 prints, then run:
```bash
pm2 save
```
Confirm the process is `online`. If it fails, inspect `pm2 logs resume-backend`.

## Phase 4 — Configure Nginx

### 11. Set up the reverse proxy
Back up the existing default site:
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak
sudo nano /etc/nginx/sites-available/default
```
Replace the server block with:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Trailing slash on proxy_pass intentionally strips the /api/ prefix:
    # /api/health -> backend /health
    # /api/reviews -> backend /reviews
    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Save in nano: `Ctrl+O`, Enter, then `Ctrl+X`.

Test and reload:
```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```
If `nginx -t` reports an error, fix it before restarting.

## Phase 5 — Verify the deployment

### 12. Test the app
Replace `EC2_PUBLIC_IP` with your instance's public IPv4 address:
```bash
curl http://EC2_PUBLIC_IP/api/health
```
Open `http://EC2_PUBLIC_IP` in your browser. Try submitting a resume summary and job description. When MongoDB Atlas is configured and reachable, the review is stored and can be viewed in the app.

### Troubleshooting commands
```bash
# Backend state and logs
pm2 status
pm2 logs resume-backend --lines 100

# Nginx state and logs
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log

# Check whether Node is listening locally
curl -i http://127.0.0.1:5000/health
sudo ss -lntp | grep -E ':80|:5000'
```

Common causes:
- **Website does not open:** verify EC2 security group port 80, Nginx status, and the public IP.
- **API returns 502:** check PM2 status/logs and confirm the backend listens on port 5000.
- **MongoDB status disconnected:** check `MONGODB_URI`, Atlas database user credentials, IP allowlist, and outbound connectivity.
- **Review not saved:** MongoDB must be connected; check backend logs.
- **Frontend changes do not appear:** rebuild with `npm run build`, copy `dist/.` to `/var/www/html/`, and hard-refresh the browser.
- **After a code update:** `git pull` in the project folder; rebuild/copy the frontend if changed; run `cd ~/ai-resume-roaster/backend && npm install && pm2 restart resume-backend --update-env` if backend dependencies/code changed.

## Final checklist
- [ ] Ubuntu 24.04 EC2 instance running
- [ ] Security group allows SSH only from your IP and HTTP from users
- [ ] Git, Node.js 20, npm, and Nginx installed
- [ ] Repository cloned from GitHub
- [ ] React `dist/` copied to `/var/www/html`
- [ ] Backend `.env` configured securely
- [ ] MongoDB Atlas database user and EC2 IP allowlist configured
- [ ] Backend responds on `127.0.0.1:5000/health`
- [ ] PM2 process online and startup command configured
- [ ] Nginx test passes and service is active
- [ ] Website and `/api/health` work through the EC2 public IP

## HTTPS note
The PDF marks port 443 as optional. For a real production site, use a domain name and configure TLS (for example, Certbot with Let's Encrypt) before collecting sensitive user data. The public-IP HTTP setup is for learning/testing.
