# 🚀 MemoChat Deployment Guide

Since Railway's free tier has ended, here are the best **free alternatives** to deploy your MemoChat backend:

---

## 🎯 Quick Comparison

| Platform | Free Tier | Best For | Limitations |
|----------|-----------|----------|-------------|
| **Render** | 750 hrs/month | Easy deployment | Sleeps after 15min inactivity |
| **Fly.io** | 3 shared VMs | Performance | Learning curve |
| **Cyclic** | Unlimited | Node.js apps | Limited resources |
| **Glitch** | Always on (paid) | Quick prototypes | Resource limits |
| **Vercel** | Free forever | Serverless | 10s function timeout |

---

## 1️⃣ Render (Recommended) ⭐

**Pros:** Easy to use, 750 hours free/month, auto SSL
**Cons:** Sleeps after 15 minutes of inactivity

### Steps:
1. **Sign up** at [render.com](https://render.com)
2. **Connect GitHub** repository
3. **Create Web Service**
   - Name: `memochat-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Add Environment Variables:**
   ```
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-url.com
   PORT=3001
   ```
5. **Deploy** and get your URL!

### Keep-Alive Trick:
Use a cron service like [cron-job.org](https://cron-job.org) to ping your `/api/health` endpoint every 10 minutes.

---

## 2️⃣ Fly.io

**Pros:** Great performance, 3 VMs free, always on
**Cons:** Requires CLI installation

### Steps:
1. **Install Fly CLI:**
   ```bash
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Launch app:**
   ```bash
   fly launch
   ```

4. **Set environment variables:**
   ```bash
   fly secrets set NODE_ENV=production
   fly secrets set FRONTEND_URL=https://your-frontend.fly.dev
   ```

5. **Deploy:**
   ```bash
   fly deploy
   ```

---

## 3️⃣ Cyclic

**Pros:** Unlimited free tier, very easy
**Cons:** Limited to 512MB RAM

### Steps:
1. **Sign up** at [cyclic.sh](https://www.cyclic.sh)
2. **Connect GitHub** repository
3. **Select repository** and branch
4. **Add environment variables** in dashboard
5. **Deploy automatically**

---

## 4️⃣ Railway Alternative (When You Need It)

**Railway Student Pack:**
- Get $5/month credit through [GitHub Student Developer Pack](https://education.github.com/pack)
- Enough for small projects

---

## 5️⃣ Self-Hosted Options

### Oracle Cloud (Always Free)
- 2 VMs with 1GB RAM each
- Always free, no credit card required initially
- [Sign up here](https://www.oracle.com/cloud/free/)

### DigitalOcean
- $200 credit for 60 days
- Then $4-6/month
- [Get credit here](https://www.digitalocean.com/try/free-trial)

### AWS EC2
- 750 hours/month free for 12 months
- t2.micro instance
- [AWS Free Tier](https://aws.amazon.com/free/)

---

## 🔧 Configuration for Production

### Update your `.env` for production:
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-actual-frontend-url.com
RATE_LIMIT_MAX_REQUESTS=50
LOG_LEVEL=error
```

### Update CORS in server.js:
Make sure `process.env.FRONTEND_URL` matches your deployed frontend URL.

---

## 📊 Monitoring Your Deployment

### Free Monitoring Tools:
1. **Uptime Robot** - Monitor if your app is up
2. **Better Stack** - Free logging
3. **Sentry** - Error tracking (50k errors/month free)

---

## 🐛 Troubleshooting

### App sleeps after inactivity (Render/Heroku)
**Solution:** Use a cron job to ping your endpoint every 10-14 minutes

### WebSocket connections failing
**Solution:** Check if your hosting provider supports WebSockets
- Render: ✅ Supported
- Fly.io: ✅ Supported
- Cyclic: ✅ Supported
- Vercel: ❌ Not for persistent connections

### CORS errors
**Solution:** Update `FRONTEND_URL` in environment variables to match your deployed frontend

---

## 🎁 Student Benefits

If you're a student, get free credits:
- **GitHub Student Pack**: Railway, DigitalOcean, Azure
- **AWS Educate**: $100+ credits
- **Google Cloud**: $300 credits
- **Azure for Students**: $100 credits

---

## 💡 Best Recommendation

**For MemoChat specifically:**

1. **Development:** Local or Cyclic
2. **Demo/Portfolio:** Render (free tier)
3. **Production/Heavy use:** Fly.io or paid Railway
4. **Learning:** Oracle Cloud (always free)

---

## 🆘 Need Help?

- Check deployment logs on your platform
- Verify environment variables are set
- Test locally first with `npm start`
- Check firewall/port settings

---

**Made with ❤️ for seamless deployment**

