---
starter_id: 10x-astro-starter
package_manager: npm
project_name: zwrotnik
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Zwrotnik to solowy, jednotygodniowy web-app MVP, którego jedyną technologię wymuszającą funkcją jest
autentykacja per użytkownik z izolacją danych — reszta to deterministyczny silnik pilności nad prostym
CRUD-em. `10x-astro-starter` pokrywa to z pudełka: Astro + React 19 (interaktywne wyspy na liście) +
TypeScript (jawne kontrakty, mocna „agent-friendly" baza) + Tailwind, a do tego Supabase (Postgres + auth +
RLS, które wprost realizuje twardy guardrail „użytkownik widzi tylko swoje pozycje") i deploy na Cloudflare
Pages (edge, free tier, publiczny URL pod późniejsze SEO). Stack jest typowany, konwencjonalny, popularny
w danych treningowych i dobrze udokumentowany — przechodzi wszystkie cztery bramki agent-friendly, więc
agent dowiezie szybko, co jest kluczowe przy budżecie jednego tygodnia. CI/CD: GitHub Actions z auto-deploy
po merge do głównej gałęzi. Świadomie odrzucone na teraz: surowe AWS/GCP (koszt czasu), natywne aplikacje
i realne płatności (późniejsza wersja) — architektura Supabase z tokenowym auth zostawia drzwi otwarte na
przyszłe natywne klienty na ten sam backend.
