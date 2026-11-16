# Implementation checklist

- [x] Add a dedicated `/client-intake/` page.
  - [x] Require the client to create and share a Google Drive folder first.
  - [x] Provide a recommended folder structure for logos, assets, business context, marketing, outreach, customer service, and system links.
  - [x] Warn clients not to place passwords, API keys, payment-card data, Social Security numbers, or other secrets in the folder.
  - [x] Collect business name, contact email, folder link, automation priorities, current tools, and approval owner.
  - [x] Create a copyable handoff summary in the browser without uploading files or secrets.
- [x] Link the landing page CTAs and footer to the client intake.
- [x] Add the static route manifest for the landing page, demo, and intake.
- [x] Document the internal delivery workflow in `service-workflow.md`.
- [ ] Replace clipboard handoff with a connected CRM/email endpoint once the preferred destination and sender address are confirmed.
- [ ] Add client-specific authentication and folder permission verification if the service requires automated Drive inspection.
