# 🎓 CampusPulse

> **AI-Powered Multi-Tenant Campus Feedback & Continuous Improvement Platform**

CampusPulse is a modern, enterprise-grade feedback and continuous improvement system engineered for higher education institutions. By leveraging conversational AI, automated sentiment & topic analysis, vector-based RAG (Retrieval-Augmented Generation), and role-based action workflows, CampusPulse transforms raw student feedback into actionable institutional improvements.

---

## 📋 Table of Contents

- [Deep-Dive Feature Breakdown](#-deep-dive-feature-breakdown)
  - [1. Multi-Tenant Architecture & Data Isolation](#1-multi-tenant-architecture--data-isolation)
  - [2. Role-Based Access Control (RBAC) & Security](#2-role-based-access-control-rbac--security)
  - [3. Campaign Management & Multi-Modal Feedback Collection](#3-campaign-management--multi-modal-feedback-collection)
  - [4. Automated AI Processing & Background Intelligence](#4-automated-ai-processing--background-intelligence)
  - [5. Retrieval-Augmented Generation (RAG) Document System](#5-retrieval-augmented-generation-rag-document-system)
  - [6. Closed-Loop Continuous Improvement Workflow](#6-closed-loop-continuous-improvement-workflow)
  - [7. Institutional Analytics & Real-Time Dashboards](#7-institutional-analytics--real-time-dashboards)
  - [8. Enterprise Rate Limiting, Audit Logs & Health Monitoring](#8-enterprise-rate-limiting-audit-logs--health-monitoring)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [User Roles & Permissions](#-user-roles--permissions)
- [Monorepo Workspace Structure](#-monorepo-workspace-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started & Installation](#-getting-started--installation)
- [Demo Credentials](#-demo-credentials)
- [NPM Scripts Reference](#-npm-scripts-reference)
- [Environment Configuration](#-environment-configuration)
- [License](#-license)

---

## 🚀 Deep-Dive Feature Breakdown

### 1. Multi-Tenant Architecture & Data Isolation
CampusPulse is designed from the ground up as a multi-tenant platform capable of hosting multiple educational institutions independently on shared infrastructure.
- **Tenant Scope Isolation**: All primary database models (`Department`, `AcademicYear`, `Semester`, `Subject`, `Faculty`, `Campaign`, `Issue`, `Document`, `AuditLog`) enforce strict scoping via `tenantId`.
- **Domain Mapping**: Tenants can be bound to custom institutional domain names (e.g., `demo.campuspulse.local`).
- **Data Security**: Cross-tenant data leaks are prevented at the database and API query levels.

---

### 2. Role-Based Access Control (RBAC) & Security
Fine-grained permission management ensures that users only access resources relevant to their operational scope across 5 distinct roles:
- **Authentication**: JWT-based authentication using HTTP-only cookies and Bearer access tokens (with separate access and refresh token secrets).
- **Session Protection**: Passwords stored using industry-standard `bcryptjs` salted hashing.
- **Role Enforcement Middleware**: Express middleware verifies user claims and permissions before accessing protected endpoint paths.

---

### 3. Campaign Management & Multi-Modal Feedback Collection

Institutional administrators can launch targeted feedback campaigns tailored to specific educational contexts.

```
       ┌─────────────────────────────────────────────────────────┐
       │                Feedback Campaign Launch                 │
       └────────────────────────────┬────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│   Traditional Form Mode       │               │   Conversational AI Mode      │
│ - Standardized ratings        │               │ - Interactive LLM Chatbot     │
│ - Text prompt submissions     │               │ - Adaptive follow-up probes   │
└───────────┬───────────────────┘               └───────────┬───────────────────┘
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │ Submission Token Hashing    │
                     │ (Ensures Student Anonymity) │
                     └─────────────────────────────┘
```

- **Flexible Campaign Scoping**: Campaigns can target specific Academic Years, Semesters, Departments, Subjects, or Faculty Members.
- **Student Eligibility Verification**: Eligibility can be enforced via rule evaluation or explicit student enrollment lookup (`CampaignEligibility` mapping), ensuring only authorized students participate.
- **Dual Submission Modes**:
  1. **Traditional Form Mode**: Fast, structured quantitative ratings and open-ended qualitative prompts.
  2. **Conversational AI Agent Mode**: Interactive chat assistant that dynamically prompts students for details, probes into vague feedback (e.g., *"Can you elaborate on what made the lab sessions unhelpful?"*), and synthesizes rich feedback narratives.
- **Anonymity Safeguards**: Feedback submissions generate a secure `submissionTokenHash` to prevent re-identifying students while guaranteeing one submission per student per campaign.

---

### 4. Automated AI Processing & Background Intelligence

Raw feedback is processed asynchronously in the background without blocking API request threads.

- **BullMQ Background Queues**: Powered by Redis, the `@campuspulse/worker` package consumes queued feedback jobs (`feedback-analysis`).
- **Automated Sentiment Analysis**: Utilizes LLMs (via Groq / OpenAI) to categorize feedback into `POSITIVE`, `NEGATIVE`, `NEUTRAL`, or `MIXED` with associated confidence scores.
- **Topic & Issue Extraction**: Automatically identifies key themes (e.g., "Grading Clarity", "Lab Equipment", "Lecture Pacing") and flags underlying issues.
- **Resilient Fallback Processing**: Designed to retry failed AI calls automatically and degrade gracefully if external LLM providers experience downtime.

---

### 5. Retrieval-Augmented Generation (RAG) Document System

CampusPulse incorporates a full RAG pipeline to contextualize AI responses and allow institution administrators to query campus policy documents.

- **Document Ingestion**: Upload course syllabi, university policy handbooks, grading rubrics, and departmental guidelines (`PDF` format).
- **Text Splitting & Parsing**: Extracts raw text via `pdf-parse` and divides documents into semantically coherent chunks using `@langchain/textsplitters`.
- **Vector Embeddings**: Computes 1536-dimensional embeddings for each document chunk using OpenAI embedding models (`text-embedding-3-small` / `text-embedding-ada-002`).
- **pgvector Integration**: Embeddings are stored directly within PostgreSQL using the `pgvector` extension (`vector(1536)`). Vector distance indices allow lightning-fast cosine similarity searches to ground AI answers in official campus documentation.

---

### 6. Closed-Loop Continuous Improvement Workflow

CampusPulse ensures feedback does not end with analytics; it drives structured institutional action.

```mermaid
graph LR
    A["💬 Student Feedback"] --> B["🤖 AI Sentiment & Topic Extraction"]
    B --> C["🚩 Issue Identification"]
    C --> D["🏢 Department Assignment"]
    D --> E["📋 Improvement Action Plan"]
    E --> F["📢 Published Transparency Update"]
    F --> G["🎓 Student Resolution View"]
```

- **Issue Identification**: Automatically clusters AI-flagged issues or allows department reviewers to manually create tracked `Issues` from recurring feedback patterns.
- **Departmental Routing**: Assigns issues to target departments (`assignedDepartmentId`) and designated reviewers (`assignedReviewerId`).
- **Action Plan Management**: Create concrete `Improvement Actions` with assigned owners, target completion dates, status tracking (`PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), and resolution notes.
- **Student Transparency Updates**: Department reviewers publish official `PublishedUpdates` directly back to the student portal, demonstrating how student feedback led to tangible institutional improvements.

---

### 7. Institutional Analytics & Real-Time Dashboards

Interactive data visualizers provide actionable insights at every level of the institution.
- **Sentiment Distribution**: Recharts pie & bar visualizations breaking down positive vs. negative feedback across departments and courses.
- **Campaign Response Tracking**: Track completion rates, submission volume over time, and modality breakdown (Conversational vs Traditional).
- **Issue Resolution Progress**: Executive views highlighting open vs. resolved issues, average time-to-resolution, and departmental response rates.

---

### 8. Enterprise Rate Limiting, Audit Logs & Health Monitoring
- **Redis-Backed Rate Limiting**: Throttles sensitive authentication endpoints (`/api/v1/auth/login`) and feedback submission routes using `express-rate-limit` with Redis storage, preventing brute-force and spam attacks.
- **Audit Logging**: Every administrative action, campaign creation, issue assignment, and role change is logged to the `AuditLog` table with actor IDs, client IP addresses, user agents, and timestamps.
- **System Health Checks**: Dedicated `/api/v1/health` endpoint monitors database response times, Redis queue connectivity, and worker health.

---

## 🏗 System Architecture

CampusPulse uses an event-driven, microservices-style monorepo architecture with background worker queues:

```mermaid
graph TD
    Client["🌐 Frontend Application (React / Vite)"]
    API["⚡ Core REST API (Express / Node.js)"]
    DB[("🐘 PostgreSQL + pgvector")]
    Cache[("🔴 Redis Store")]
    Worker["⚙️ Background Worker (BullMQ + LangChain)"]
    LLM["🧠 LLM Services (Groq / OpenAI)"]

    Client -->|HTTP / JSON| API
    API -->|ORM Queries| DB
    API -->|Rate Limits & Sessions| Cache
    API -->|Queue Jobs| Cache
    Cache -->|Consume Jobs| Worker
    Worker -->|Read/Write Embeddings & Analysis| DB
    Worker -->|RAG & Feedback Extraction| LLM
```

---

## 🛠 Tech Stack

### **Frontend (`apps/web`)**
- **Framework**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons
- **State & Data Fetching**: TanStack React Query v5, Zustand, Axios
- **Routing & Forms**: React Router v6, React Hook Form, Zod Validation
- **Data Visualization**: Recharts

### **Backend API (`apps/api`)**
- **Runtime & Framework**: Node.js, Express.js, TypeScript
- **Database & ORM**: PostgreSQL 16 (`pgvector` extension), Prisma ORM
- **Authentication & Security**: JWT (Access/Refresh tokens), bcryptjs, Helmet, Express Rate Limit (Redis store)
- **Queues & Caching**: ioredis, BullMQ
- **Validation & Logging**: Zod, Winston

### **Background Worker (`apps/worker`)**
- **Job Processing**: BullMQ, Node.js
- **AI & RAG Pipeline**: LangChain (`@langchain/openai`, `@langchain/core`), PDF parsing (`pdf-parse`)
- **LLM Integrations**: Groq API (GPT-OSS / Llama models), OpenAI Vector Embeddings

### **Shared Packages (`packages/shared`)**
- Shared TypeScript interfaces, Zod schemas, contract definitions, and role enumerations across frontend, backend, and worker.

### **Infrastructure & DevOps**
- **Monorepo Tools**: pnpm Workspaces, Turborepo (`turbo`)
- **Containerization**: Docker, Docker Compose (PostgreSQL with `pgvector`, Redis 7)

---

## 👥 User Roles & Permissions

CampusPulse enforces fine-grained Role-Based Access Control (RBAC):

| Role | Icon | Scope & Capabilities |
| :--- | :---: | :--- |
| **`PLATFORM_OWNER`** | 👑 | System-wide access, tenant creation, global system configuration & health monitoring. |
| **`INSTITUTION_ADMIN`** | 🏫 | Full institutional management: create campaigns, manage departments, faculty, subjects, academic years, and view analytics. |
| **`DEPARTMENT_REVIEWER`** | 🔍 | Department-level access: review identified issues, define improvement actions, and publish updates to students. |
| **`FACULTY`** | 👨‍🏫 | View subject/course feedback analysis, campaign responses, and continuous improvement updates. |
| **`STUDENT`** | 🎓 | Participate in eligible campaigns via traditional or conversational AI modes, view published institutional updates. |

---

## 📂 Monorepo Workspace Structure

```
CampusPulse/
├── apps/
│   ├── api/                # Core Express REST API (Auth, Campaigns, Issues, Analytics)
│   │   ├── prisma/         # Prisma Schema & Database Seed Scripts
│   │   └── src/
│   ├── web/                # React Single Page Application (UI, Dashboards, Chat)
│   │   └── src/
│   ├── worker/             # BullMQ Worker (Sentiment Analysis, Document RAG Ingestion)
│   │   └── src/
│   └── uploads/            # Uploaded document storage
├── packages/
│   └── shared/             # Shared Types, Enums (UserRole), Zod Schemas
├── docker-compose.yml      # Local services (PostgreSQL + pgvector, Redis)
├── package.json            # Root monorepo scripts & dependencies
├── pnpm-workspace.yaml     # pnpm workspace configuration
└── turbo.json              # Turborepo pipeline setup
```

---

## ⚡ Prerequisites

Before installing, ensure you have the following installed on your system:

- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`npm i -g pnpm`)
- **Docker Desktop** (or Docker Engine + Docker Compose)

---

## 🚀 Getting Started & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/CampusPulse.git
cd CampusPulse
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Environment Setup
Copy the environment template to `.env`:
```bash
cp .env.example .env
```
*(Optionally set `LLM_API_KEY` for Groq/OpenAI if testing AI conversational & worker analysis features locally).*

### 4. Start Infrastructure Containers
Launch PostgreSQL (with `pgvector`) and Redis:
```bash
docker compose up -d
```

### 5. Setup Database & Migrations
Generate Prisma client and apply database migrations:
```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Seed Demo Data
Populate default roles, a demo tenant, and pre-configured user accounts for each role:
```bash
pnpm db:seed
```

### 7. Run Development Server
Start all workspace applications (`web`, `api`, and `worker`) concurrently:
```bash
pnpm dev
```

- **Frontend Web App**: [`http://localhost:5173`](http://localhost:5173)
- **Backend REST API**: [`http://localhost:3000`](http://localhost:3000)

---

## 🔑 Demo Credentials

The database seeder creates default demo accounts for testing each role. All demo accounts share the same password.

> **Password for all demo accounts**: `Password123!`

| Role | Email Address | Description |
| :--- | :--- | :--- |
| **Platform Owner** | `owner@demo.edu` | Platform operator account |
| **Institution Admin** | `admin@demo.edu` | Admin for Demo University |
| **Department Reviewer** | `reviewer@demo.edu` | Reviewer for department issues & actions |
| **Faculty Member** | `faculty@demo.edu` | Faculty instructor account |
| **Student** | `student@demo.edu` | Student feedback participant |

---

## 📜 NPM Scripts Reference

Run these commands from the root directory:

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts API, Web, and Worker concurrently in watch mode |
| `pnpm build` | Builds all packages and applications for production using Turbo |
| `pnpm lint` | Runs ESLint across all workspaces |
| `pnpm typecheck` | Runs TypeScript type checking across all workspaces |
| `pnpm db:generate` | Generates Prisma Client artifacts |
| `pnpm db:migrate` | Runs Prisma dev migrations |
| `pnpm db:seed` | Seeds the database with default roles, tenant, and demo users |
| `pnpm db:studio` | Opens Prisma Studio GUI at `http://localhost:5555` |

---

## ⚙️ Environment Configuration

Key environment variables in `.env`:

```env
# Server & CORS
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"

# Database & Redis
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/campuspulse?schema=public"
REDIS_URL="redis://localhost:6379"

# Security Tokens
JWT_ACCESS_SECRET="dev-access-secret-do-not-use-in-prod"
JWT_REFRESH_SECRET="dev-refresh-secret-do-not-use-in-prod"

# AI Integrations (Groq / OpenAI)
LLM_API_KEY="your-groq-or-openai-api-key"
LLM_BASE_URL="https://api.groq.com/openai/v1"
LLM_MODEL_NAME="openai/gpt-oss-120b"
OPENAI_API_KEY="your-openai-key-for-embeddings"
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
