# FlowPilot Deployment Guide

## Option 1: Vercel (Landing Page + Demo) — FASTEST

```bash
# Install Vercel CLI
npm i -g vercel

# From project root
vercel --prod

# Or drag-and-drop the landing-page/ folder to vercel.com
```

Your landing page will be live at `https://your-project.vercel.app`
Your demo will be at `https://your-project.vercel.app/demo`

## Option 2: Railway (Server) — FASTEST

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables
railway variables set LLM_API_KEY=sk-...
railway variables set CLIENT_API_KEYS=fp_client_1,fp_client_2
railway variables set ALLOWED_ORIGINS=https://your-app.com
```

## Option 3: Render (Server)

1. Connect your GitHub repo to Render
2. Use `deploy/render.yaml` as the blueprint
3. Set environment variables in Render dashboard
4. Deploy

## Option 4: Docker (Any VPS)

```bash
# Build and run
cd deploy
docker-compose up -d

# Or manually
docker build -f Dockerfile -t flowpilot-server ..
docker run -p 3001:3001 -e LLM_API_KEY=sk-... flowpilot-server
```

## Option 5: Netlify (Landing Page + Demo)

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=landing-page
```

## Complete Stack Deployment

### Recommended Setup:
1. **Landing Page + Demo:** Vercel (free, fast CDN)
2. **Proxy Server:** Railway or Render ($5-20/mo)
3. **Domain:** Cloudflare or Namecheap ($10-15/yr)
4. **Email:** Resend or SendGrid (free tier)
5. **Analytics:** Plausible or Google Analytics (free)
6. **Payments:** Stripe (2.9% + $0.30 per transaction)

### Monthly Costs (Conservative):
| Service | Cost |
|---------|------|
| Vercel Pro | $20 |
| Railway/Render | $15 |
| Domain | $1 |
| Resend Email | $0 (free tier) |
| Stripe | $0 (pay per transaction) |
| LLM API (OpenAI) | $50-200 (usage-based) |
| **Total** | **~$86-236/mo** |

### Monthly Costs (Bootstrap):
| Service | Cost |
|---------|------|
| Vercel Free | $0 |
| Railway Starter | $5 |
| Domain | $1 |
| Resend Email | $0 |
| Stripe | $0 |
| LLM API | $20-50 |
| **Total** | **~$26-56/mo** |

## Environment Variables

### Server (.env)
```
NODE_ENV=production
PORT=3001
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-openai-key
LLM_BASE_URL=https://api.openai.com/v1/chat/completions
CLIENT_API_KEYS=fp_client_abc123,fp_client_def456
ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com
```

### Client (FlowPilot Config)
```javascript
const pilot = new FlowPilot({
  proxyURL: 'https://your-server.com/api/flowpilot',
  preset: 'ecommerce-support'
});
```

## SSL / HTTPS

Always use HTTPS in production. Vercel, Railway, and Render provide SSL automatically.

If self-hosting:
```bash
# Using Caddy (recommended)
caddy reverse-proxy --from your-domain.com --to localhost:3001

# Or use Let's Encrypt with nginx
certbot --nginx -d your-domain.com
```

## Monitoring

### Server Health
```bash
curl https://your-server.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Uptime Monitoring
- UptimeRobot (free tier)
- Pingdom
- Better Uptime

### Error Tracking
- Sentry (free tier)
- LogRocket

### Analytics
- Plausible (privacy-friendly, $9/mo)
- Google Analytics (free)
- Mixpanel (free tier)

## Scaling

### When you hit 10K MAU:
1. Upgrade server plan (Railway Pro, Render Standard)
2. Add Redis for session caching
3. Implement request queueing for LLM calls
4. Add CDN for static assets

### When you hit 100K MAU:
1. Move to AWS/GCP with auto-scaling
2. Implement rate limiting per client
3. Add database for usage tracking
4. Consider dedicated LLM infrastructure

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Check ALLOWED_ORIGINS includes your domain |
| 401 Unauthorized | Verify CLIENT_API_KEYS match |
| LLM timeout | Increase timeout in server config |
| Slow responses | Use gpt-4o-mini or enable caching |
| Widget not loading | Check proxyURL is correct and reachable |

## Next Steps

1. Deploy landing page to Vercel
2. Deploy server to Railway
3. Point domain to Vercel
4. Set up Stripe for payments
5. Configure email (Resend)
6. Add analytics
7. Launch on Product Hunt
8. Start selling!
