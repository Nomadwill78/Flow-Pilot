# Muse + Cue Automation Service Workflow

## Purpose

Provide small-business owners with practical automation for marketing, outreach, and customer service using Muse and Cue, beginning with a client-owned Google Drive folder that becomes the shared source of truth.

## Intake gate: client folder first

1. Client creates a Google Drive folder.
2. Client adds available business materials: logos and creative assets, business plan, offers and pricing, customer and outreach context, marketing content, customer-service material, and links to current systems.
3. Client shares the folder with the Nomad Consulting contact before submitting the intake.
4. Client confirms that the folder contains no passwords, API keys, payment-card data, Social Security numbers, or other secrets.
5. Client submits the folder link, priorities, current tools, and approval owner through `/client-intake/`.

## Folder structure to recommend

- `01 Brand & creative`
- `02 Business context`
- `03 Customers & outreach`
- `04 Marketing`
- `05 Customer service`
- `06 Access & systems (links only)`

## Delivery workflow

### 1. Review and normalize

Review the shared folder, identify missing information, note conflicting instructions, and create a concise business context brief. Do not copy secrets into working notes.

### 2. Choose the first automation

Select one workflow with a clear owner, repeat frequency, measurable value, and low downside if a human must approve the result. Good first candidates include content repurposing, lead follow-up drafts, FAQ triage, appointment reminders, review-response drafts, and weekly reporting.

### 3. Define the agent contract

For each Muse or Cue agent, document the purpose, inputs, tools, allowed actions, blocked actions, approval points, escalation rules, output format, and owner.

### 4. Configure and test

Use representative examples from the client folder. Test normal cases, incomplete information, ambiguous requests, prompt-injection attempts, sensitive data, and requests requiring human approval.

### 5. Launch with approval gates

Start in draft or recommendation mode. Human approval is required for outbound messages, pricing or policy changes, commitments, refunds, account changes, and any irreversible action unless the client explicitly authorizes a narrower exception.

### 6. Measure and improve

Track time saved, response time, draft acceptance rate, escalations, errors, customer outcomes, and owner satisfaction. Review the workflow after the first two weeks and make one controlled change at a time.

## Standard handoff package

- Business context brief
- Automation opportunity map
- First-agent specification
- Guardrails and approval matrix
- Test cases and results
- Launch checklist
- 14-day review notes

## Initial success measures

Agree on one primary and two secondary measures before launch. Examples: hours saved per week, qualified follow-ups completed, first-response time, percentage of support questions drafted without rework, or content pieces approved per month.
