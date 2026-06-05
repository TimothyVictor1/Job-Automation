# Timothy Victor Rachuri — Complete Project Reference
*Use this document as the source of truth for all future resumes, cover letters, and applications.*

---

## PROJECT 1 — Agentic Case Management System · Försäkringskassan

**Status:** Prototype built and presented → Advancing toward full production deployment
**Client:** Försäkringskassan (Swedish Social Insurance Agency)
**Context:** Built through Tech Concept Lab, Blue Science Park, Karlskrona
**Role:** Sole AI engineer — owned full design, build, and delivery

### The Problem
Försäkringskassan caseworkers were manually processing multi-step document collection, identity verification, and benefit assessment workflows. Error-prone, slow, and limited by human bandwidth.

### What Was Built
End-to-end agentic AI system that automates the full casework pipeline:
- Document intake and processing via RAG
- Identity verification logic
- Multi-step validation workflows
- AI-generated assessment drafting

### Tech Stack
- **LLM:** Claude API (claude-sonnet-4-6) — reasoning backend
- **Workflow:** n8n Cloud — automation engine
- **Database:** Supabase
- **Output structure:** Anthropic Tool Use (`tool_choice: "any"`) — structured JSON output
- **Classification:** Semantic router with 12-category benefit schema
  - Categories: vab, sick, carrier, parental, disability, housing, pregnancy, dental, omvardnad, merkostnad, sjukersattning, aktivitetsersattning
- **Frontend:** index.html (user-facing) + caseworker.html (dashboard)
- **Deployment:** Vercel (project: framtidskassan)

### Compliance Architecture
- Session-scoped data handling — no cross-session persistence
- Zero data retention — data not stored after session ends
- EU-region cloud deployment
- Full GDPR compliance by design

### Key Technical Decisions
- Switched from prompt-based JSON to Anthropic Tool Use after silent JSON parsing failures in production
- Upgraded model from claude-haiku to claude-sonnet-4-6 for reliability
- Expanded classification from 8 to 12 benefit categories based on real casework requirements

### Outcome
Prototype built, presented, and approved — advancing toward production deployment at a Swedish government agency.

---

## PROJECT 2 — Agentic Room & Meeting Booking System · Paraply

**Status:** Production — live and operating
**Client:** Paraply / The Pot (World Trade Center Karlskrona and Karlshamn)
**Context:** Built through Tech Concept Lab, Blue Science Park
**Role:** AI engineer — designed full agent architecture, built and deployed
**Key contacts:** Yessica (booking manager), Polly Larsson at Malvacom (project coordinator)

### The Problem
All bookings arrived by email. One person (Yessica) manually checked a ClickUp calendar and pricing document, then replied by hand. Process limited to business hours. No automation, no instant response, fully manual.

### What Was Built
Conversational AI agent handling the complete room and meeting booking workflow through natural dialogue — no forms, no clicks, fully automated end-to-end.

### Agent Flow
1. **Intent recognition** — understands booking request from natural language
2. **Real-time availability querying** — checks live calendar and room systems
3. **Conflict detection and resolution** — identifies clashes, suggests alternatives
4. **Preference-based room matching** — matches requirements to available spaces
5. **Booking confirmation** — completes the booking and confirms to user

### Tech Stack
- **Automation engine:** n8n (self-hosted)
- **LLM:** Claude Sonnet 4 via Anthropic API
- **PII protection:** Microsoft Presidio — tokenises customer personal data before it reaches the AI, restores real values only at booking submission
- **Vector storage:** Qdrant — semantic search over venue data
- **Session management:** Upstash Redis — rate limiting and session state
- **Calendar integration:** ClickUp — room availability and booking forms
- **Fallback:** Cloudflare Worker architecture
- **Orchestration:** MCP (Model Context Protocol) — connects LLM to live scheduling APIs

### Security Innovation
Reversible PII tokenisation: customer personal data is intercepted and replaced with consistent tokens before reaching the AI model. Real values are only restored at the moment of booking submission. No PII ever reaches the LLM context.

### Documentation
Full 47-page technical specification written covering architecture, security model, n8n workflow spec, AI system prompt, end-to-end message flow, data storage mapping, implementation plan, testing checklists, and maintenance operations.

### Outcome
Live in production. Replaced a fully manual, email-based booking process limited to business hours with a 24/7 conversational AI interface.

---

## PROJECT 3 — n8n Agentic Workflow Pipeline · Tech Concept Lab

**Status:** Production — live and operating
**Context:** Built through Tech Concept Lab, Blue Science Park
**Role:** Sole builder — designed, built, documented, deployed

### The Problem
Multi-step internal business workflows requiring manual coordination across multiple team roles. Needed to automate routing, session management, and LLM-powered processing across user types.

### What Was Built
Production-grade conversational AI automation pipeline on n8n Cloud.

### Tech Stack
- **Platform:** n8n Cloud
- **LLM backend:** Claude API / OpenAI GPT (configurable)
- **Database:** PostgreSQL — session persistence across conversations
- **Architecture:** Webhook-driven event triggers
- **Protocol:** MCP integrations — connects LLM to external tools and enterprise APIs
- **Proxy:** CORS-compliant server-side proxy layer

### Key Technical Features
- Multi-role routing — different workflow paths per user role
- Multi-turn session memory — PostgreSQL-backed conversation state
- Full error handling and retry logic
- Documented failure modes
- Playbook written so teams can own and extend without support

### Outcome
Deployed to production. Teams run and extend the system independently. Zero ongoing support required after handoff.

---

## PROJECT 4 — DIPT · AI Research Paper Monitoring System

**Status:** Active development
**Client:** Prof. Tony Gorschek, BTH (SERL Sweden — ranked #1 in EU for empirical software engineering research)
**Team:** Timothy Victor Rachuri + Rakesh Reddy Karri
**Context:** BTH university project

### The Problem
Software engineering research teams spend significant time manually discovering, reading, and curating relevant papers from dozens of journals and conferences. No automated system existed to continuously monitor, score, and surface relevant SE research.

### What Was Built
Fully automated, locally-run multi-agent AI system for continuous SE research paper discovery, scoring, and curation.

### Hardware
HP Z2 Mini G1a workstation — AMD Ryzen AI Max+ Pro 395, AMD Radeon 8060S GPU, 96GB unified memory. Runs 70B parameter LLMs entirely locally via Ollama.

### Tech Stack
- **Agent orchestration:** LangGraph + LangChain — multi-agent pipeline
- **Local LLMs via Ollama:**
  - llama3.1:70b — summarisation and categorisation
  - deepseek-r1:70b — industrial relevance scoring
  - command-r-plus — document reading
- **Vector database:** ChromaDB — semantic search and retrieval
- **Relational database:** PostgreSQL 18 — 6 tables (papers, categories, paper_categories, summaries, scores, qa_flags)
- **PDF processing:** PyMuPDF — text extraction from downloaded papers
- **Dashboard:** Streamlit — internal research team interface
- **Public site:** Next.js + Cloudflare hosting
- **Language:** Python 3.11.9

### Data Sources (7 total)
OpenAlex (14 verified SE journals filtered by ISSN), arXiv cs.SE via OAI-PMH, Semantic Scholar, DBLP (14 SE conference venues), CrossRef, Zenodo, CORE

### Classification System
47 categories spanning SWEBOK v4's 18 knowledge areas + 29 emerging SE research domains

### Agent Architecture
- **Fetch Agent:** Pulls papers from all 7 sources. LLM quality gate (llama3.1:8b) performs strict YES/NO SE relevance check before any paper enters the database
- **Parser Agent:** Downloads PDFs, extracts full text using PyMuPDF
- **Categorisation Agent:** Uses llama3.1:70b with XML-structured output at temperature 0.1. Dynamically loads categories from database at runtime
- **QA Agent:** Auto-resolves quality issues or escalates to human review

### Results in Testing
- 732 papers fetched, 543 PDFs downloaded (189 marked no_pdf available)
- 50/50 papers categorised with 0 failures in development run
- 42-minute categorisation run for 50 papers

### Design Principle
Fully model-agnostic — swap any LLM without changing code. Built as a replicable pattern for other research domains.

---

## PROJECT 5 — NeuraMQ · AI-Powered Anomaly Detection

**Status:** Production — live and operating
**Built at:** Appleton Innovations, Visakhapatnam (ML Engineering Internship, Jun–Aug 2025)
**Role:** Built end-to-end — sole engineer for the AI/ML system

### The Problem
Industrial data streams were monitored manually. Incidents were caught late, explanations were slow or absent, and the process had no automated alerting or explainability layer.

### What Was Built
Full-stack production anomaly detection system with integrated RAG pipeline for context-aware, explainable anomaly reporting.

### Tech Stack — AI/ML Layer
- **ML models:** LSTM (sequence anomaly detection), Autoencoders (reconstruction error), Isolation Forest (statistical outliers)
- **Training frameworks:** TensorFlow + PyTorch
- **RAG pipeline:** ChromaDB (vector search) + Azure OpenAI + Cohere (embeddings)
- **Vector search:** ChromaDB
- **Observability:** Evaluation scripts + performance benchmarks for retrieval accuracy

### Tech Stack — Infrastructure Layer
- **Data ingestion:** MQTT broker
- **Backend API:** FastAPI (Python)
- **Database:** PostgreSQL
- **Deployment:** Docker microservices — fully containerised
- **Frontend:** React dashboard — real-time anomaly visualisation

### Data Pipeline
MQTT → FastAPI → PostgreSQL → ML inference → ChromaDB RAG → Explainable report generation → React dashboard

### Model Lifecycle
Training (TensorFlow/PyTorch) → Experiment tracking across training runs → Model versioning → Docker deployment → Post-deployment performance monitoring

### Results
- 60% faster incident detection
- 25% throughput improvement
- Context-aware anomaly reports with natural language explanations

---

## PROJECT 6 — Thesis · Minimum Viable Guardrail (MVG) for AI

**Status:** Active research — BTH
**Institution:** Blekinge Institute of Technology
**Course:** DV1478
**Supervisor:** Dr. Sadi Alawadi
**Research collaborator:** Prof. Tony Gorschek

### Core Contribution
Introduced the **V-Ratio (T_verify / T_generate)** — a quantitative metric that measures the ratio of time spent verifying AI outputs vs. time spent generating them. Quantifies verification bottlenecks in AI-integrated software systems.

### Three Research Questions

**RQ1 — V-Ratio Empirical Study**
- Method: MSR (Mining Software Repositories)
- Dataset: 372 PRs, 11 repositories, 37 months
- Key result: Median V-Ratio of 166.4× — verification takes 166× longer than generation in practice

**RQ2 — Deterministic Testing Limitations**
- Method: Adversarial mutation testing
- Dataset: 717 mutations, 239 MBPP functions, 5 random seeds
- Key result: Dead Failure Rate (DFR) of 34.45% (std deviation 0.00% across all 5 seeds)

**RQ3 — Z-SAAP Guardrail Evaluation**
- Method: Logic-based guardrail evaluation across 6 pipeline versions
- Dataset: 956-case corpus
- Key results for Z-SAAP v6:
  - Safety Score: 49.91%
  - False Positive Rate: 22.03%
  - Accuracy: 62.03%
  - Latency: 1,258ms

### What MVG Proposes
A lightweight runtime safety envelope that constrains probabilistic AI outputs within deterministic logical boundaries — applicable to any organisation scaling AI workflows in production.

### Relevance to Industry
Directly applicable to: monitoring AI performance, preventing model drift, responsible AI governance in regulated environments (banks, government agencies, healthcare).

---

## PROJECT 7 — Visimies · Multimodal Conversational AI

**Status:** Completed — Hackathon project
**Event:** Build Bharat Hackathon 2024
**Result:** Top 15 nationally out of 400+ competing teams — National Finalist

### What Was Built
Conversational AI agent with:
- Multimodal input understanding (text + audio)
- Natural dialogue processing
- Real-time voice response generation

### Relevance
Demonstrates ability to build multimodal AI systems rapidly under competitive conditions — idea to working demo in hackathon timeframe.

---

## PROJECT 8 — AWS Serverless Image Processing · BIT DV1566

**Status:** Deployed — University course project
**Course:** DV1566, Blekinge Institute of Technology

### What Was Built
Event-driven, auto-scaling serverless image processing pipeline on AWS.

### Tech Stack
- **AWS S3** — input/output buckets + event trigger configuration
- **AWS Lambda** — Python 3.10, Boto3, Pillow image processing library
- **AWS CloudWatch** — monitoring, performance analysis, log analysis
- **AWS IAM** — roles, permissions, Lambda Layer configuration
- **Lambda Layers** — dependency management

### Pipeline Flow
S3 upload event → Lambda trigger → Image processing (Pillow) → Output to S3 → CloudWatch logging

### Results
- Demonstrated auto-scaling from 0 → 150 concurrent Lambda executions under load testing
- Tuned memory allocation and timeout configuration based on CloudWatch performance data to eliminate bottlenecks

---

## DESIGN & CREATIVE PROJECTS

### Hindustan Shipyard Defence Website · Sweya Infotech
**Client:** Hindustan Shipyard (Indian defence sector)
**Role:** UI/UX Designer
- Secure user authentication system
- Defence-sector compliance standards implementation
- Security-aware interface design

### Clappit AI Application Interface · Sweya Infotech
**Type:** AI-assisted productivity tool
**Role:** UI/UX Designer
- Designed full application interface for an AI productivity product
- Improved user engagement and feature discoverability

### District Collector's Dashboard · Sweya Infotech
**Type:** Government administrative tool
**Role:** UI/UX Designer
- Data visualisation components for administrative workflows
- Improved decision-making efficiency for district administration

### āhub Brand Identity & Logo · Freelance/Edumoon
**Role:** Brand Designer
- Created the complete brand identity for āhub
- Logo design now used as the primary brand identity

### IIT Alumni Startup Educational Platform · Huebits
**Role:** UI/UX Designer
- Complete interface design and implementation
- Focus on educational content accessibility

### Hult Prize International Campaign · AUCE
**Event:** Hult Prize (international social entrepreneurship competition initiated by President Bill Clinton)
**Role:** Graphic Design Lead
- Complete brand assets for campus-wide competition
- Pitch presentation design, social media content, event collateral
- Reached 1,000+ students
- Managed end-to-end creative production

### GDG Design System · Google Developer Student Club · AUCE
**Role:** Graphic Design Lead (Aug 2023 – Present)
- Promotional materials and social media content for GDG events
- Design systems for technical workshops and hackathons
- Aligned with Google brand guidelines
- Mentored team members on design best practices

### Freelance Graphic Design · Remote
**Platforms:** Fiverr, Upwork, Freelancer.com
**Duration:** May 2020 – Dec 2022
**Scale:** 50+ projects, clients across USA, UK, Canada, Australia
**Services:** Graphic design, UI/UX, logo creation, video editing
**Result:** 90%+ client satisfaction rate

---

*Last updated: June 2026*
