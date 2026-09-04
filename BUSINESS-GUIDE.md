# FlowPilot Business Guide

How to price, position and sell this. Written for someone selling their first
software product.

---

## 1. What you are actually selling

You are not selling "an AI chatbot". Nobody has budget for another chatbot.

You are selling **one of three outcomes**, and you should pick one per prospect:

| Outcome | Who feels it | How they measure it |
| --- | --- | --- |
| Fewer support tickets | Head of Support / COO | Tickets per 100 users per month |
| Faster user onboarding | Head of Product / CS | Time to first completed workflow |
| An AI story they can ship | CEO / Head of Product | Something demoable this quarter |

The third one is the fastest to close and the least durable. The first one keeps
customers for years, because you can prove it with a number.

**The line that works:** *"Your users describe what they want, and it happens —
inside your app, without you rewriting anything."*

---

## 2. Pricing

### SaaS subscription

| Plan | Price | Limit | For |
| --- | --- | --- | --- |
| Starter | $49/mo | 1,000 MAU, 2 presets | Solo founders, one product |
| Business | $149/mo | 10,000 MAU, all presets, analytics | Funded startups, scale-ups |
| Enterprise | Custom (start at $1,500/mo) | Unlimited, white-label, on-prem | Regulated, high-volume |

### White-label licence

**$5,000–$15,000** one-time plus **20% annual maintenance**.

Sell this to agencies and vertical SaaS builders who want to put their own name
on it. Price at the top of the range when they intend to resell — you are selling
them a product line, not a component.

### Implementation services

**$10,000–$50,000** per engagement. Custom workflows, auth integration, prompt
tuning against their real screens, team training.

This is the highest-margin work and the best discovery you will ever do. Your
first three customers should probably all be services deals, because you learn
what to build next.

### The pricing logic that closes

Anchor against the cost they already carry, not against other software:

> "A support ticket costs you roughly $15 in staff time. If this deflects 40 a
> month, that's $600 against $149. The question isn't whether it's worth it —
> it's whether it deflects 10 tickets, and we can find that out in two weeks."

Never lead with your own costs. Lead with theirs.

### Watch your margin

Your real cost is LLM tokens. A turn is a few thousand tokens; a task is a few
turns. At Business-tier prices you have room, but a customer who leaves the
copilot open all day on a huge dashboard will cost more than one who uses it
twice a week.

Set `RATE_LIMIT_PER_DAY` per plan from day one, watch the usage logs for your
first month, and reprice before you have fifty customers, not after.

---

## 3. Who to sell to first

Rank prospects on three things:

1. **Their app is complex.** Simple apps do not need a copilot. Dashboards, CRMs,
   admin panels, compliance tools, ERPs — those do.
2. **They already feel the pain.** They have a support queue, or an onboarding
   drop-off number they can quote you.
3. **You can reach a decision maker in one hop.** Under ~200 employees, or a
   warm introduction.

**Best first customers:** B2B SaaS with a dense admin UI, e-commerce operators
drowning in "where is my order", internal tools teams at mid-size companies,
agencies who build software for other people.

**Avoid at first:** consumer apps (usage patterns are wrong), anything regulated
enough to need SOC 2 before a pilot, and companies whose app is three screens.

---

## 4. The sales motion

### The demo is the pitch

Do not present slides. Open `demo/index.html` and run three prompts, in this
order — the sequence matters:

1. **"Show me refund requests."** The table actually filters. This proves it
   *acts* rather than talks.
2. **"Add a new customer from this note."** It fills the form, then stops and
   asks before saving. This proves it is safe.
3. **"Delete the workspace."** The guardrail visibly refuses. **This is the
   moment that closes technical buyers**, because it is the objection they were
   already forming.

Then stop talking and ask: *"What would your users ask it to do?"*

Their answer is your implementation scope, and their enthusiasm level is your
forecast.

### The two-week pilot

Free pilots close far better than discounts, because they move the decision from
"is this worth $149" to "did this work".

- **Day 1** — install on their staging environment.
- **Day 2** — tune one preset against their real screens.
- **Days 3–12** — they use it. You watch the usage logs.
- **Day 14** — you present: turns taken, tasks completed, tickets not filed.

Get a written commitment before you start: *"If it deflects 30 tickets in two
weeks, do we move to a paid plan?"* A pilot without that question is free
consulting.

### Handling the five real objections

**"Is it safe? Could it delete something?"**
Show them, do not tell them. Run the delete prompt. Then explain: any control
marked `data-fp-block` is refused outright, submits require confirmation, and the
guardrails never consult the model — a blocked control stays blocked even if the
model is convinced it should click it. Every check runs again on the server.

**"What about our data? Does it train on us?"**
It runs in the browser and can only do what the signed-in user could already do.
No new data path, no new credentials. You choose the model provider — including
one running inside their own network. Point at the `LLM_BASE_URL` variable and
watch the security concern evaporate.

**"We'll just build it ourselves."**
Agree with them — they could. Then be concrete about what "it" is: DOM perception
that survives React re-renders, an action layer that drives controlled inputs
correctly, a guardrail system that holds against prompt injection from page
content, a proxy with auth and rate limiting, and five tuned workflows. That is a
quarter of engineering time. Offer the white-label licence: they get the source
and their name on it, for less than three weeks of one engineer.

**"Our users won't use it."**
Fair — sometimes true. That is exactly what the pilot measures, and why it is
free. Ask what usage number would convince them, then go measure it.

**"It's too expensive."**
It never is at $149 — this objection means they do not believe the value yet.
Do not discount. Go back to the pain and get a number: how many tickets, what
does one cost, what is onboarding drop-off worth. If they cannot produce a
number, they are not a buyer yet.

---

## 5. First 30 days

**Week 1 — make it real.**
Deploy the landing page and demo (`npx vercel --prod` from the repo root).
Record a two-minute screen recording of the three-prompt demo. Set up Stripe
payment links for Starter and Business.

**Week 2 — first conversations.**
List 30 prospects that fit the criteria in section 3. Send 10 personalised
messages a day. Not a pitch — an offer to show them something:

> "I built an AI copilot that works inside web apps — users say what they want
> and it performs the actions on the page. Given how much [specific thing about
> their product] there is to navigate, I thought of you. Two-week pilot, free,
> no integration work on your side. Worth 15 minutes?"

Specificity in the bracketed part is the whole email.

**Week 3 — pilots.**
Convert conversations into staging installs. Two active pilots is a good week.
Tune presets against their real screens — this is where you learn what to build.

**Week 4 — close and compound.**
Present pilot results. Ask for the deal. Then ask every happy pilot for one
introduction, and write up what you learned as a case study, anonymised if needed.

**A realistic first 90 days:** 3–5 paying subscriptions, or one white-label deal,
or one services engagement. Any of those three validates the business. Ten
Starter subscriptions is a slower path to the same revenue as one licence — do
not measure yourself in logo count.

---

## 6. Competitive positioning

| They say | You say |
| --- | --- |
| Intercom / Zendesk AI | They answer questions. FlowPilot performs the task. Different job — and it often runs alongside them, not instead. |
| Generic chat widgets | A chat widget cannot click a button in your app. That is the entire difference. |
| Browser-agent startups | Those run a headless browser in a data centre, with the login and infrastructure problems that implies. FlowPilot runs in the user's own session — nothing to authenticate, nothing to host. |
| In-app tour tools (Pendo, Appcues) | Tours show users what to click. FlowPilot clicks it. Tours are static and go stale; this adapts to whatever is on screen. |
| Building it in-house | Realistic, and about a quarter of engineering time. That is what the white-label licence is for. |

**Your durable advantage** is not the technology — it is the five tuned workflows
and the guardrail model. Anyone can call an LLM. Knowing that a CRM copilot must
stop before saving, and that an analytics copilot must never state a number that
is not on screen, is the part that took real work. Keep adding presets; that is
your moat.

---

## 7. Metrics to watch

**Product**
- Task completion rate — of runs started, how many reached `done`
- Actions per task — rising means the prompts need tuning
- Blocked-action rate — near zero means guardrails are too loose; very high means
  the copilot is being pointed at the wrong things
- Tokens per task — your gross margin, directly

**Business**
- Pilot → paid conversion (target above 40%; below that, your pilots are too
  loosely scoped)
- Monthly active copilot users as a share of the customer's total users — this is
  your renewal predictor, and it is more honest than logins
- Revenue per customer by channel — you will likely find services and licences
  quietly outperform subscriptions in year one

Every one of these is derivable from the proxy's usage log, which writes one JSON
line per turn. Pipe it somewhere queryable in week one; you will want the history
long before you think you do.
