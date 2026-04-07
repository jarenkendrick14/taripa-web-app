# 🛺 TARIPA — Tricycle Fare Monitoring & Accountability System

**TARIPA** (from Filipino *taripa* — "fare") is a full-stack web application designed to promote fare transparency, commuter safety, and driver accountability for tricycle transportation in **Angeles City, Pampanga**. It empowers commuters to verify legal fares, report overcharging, and contribute to community-driven oversight — all backed by automated reporting to the city's Public Transport Regulatory Office (PTRO).

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [API Reference](#-api-reference)
- [Scheduled Jobs](#-scheduled-jobs)
- [Deployment](#-deployment)
- [Default Admin Credentials](#-default-admin-credentials)

---

## ✨ Features

### 🧾 Resibo — Fare Calculator
Compute the legal tricycle fare between any two points within Angeles City based on the active fare ordinance (Ordinance No. 723, S-2024). Supports discounted rates for **students**, **senior citizens**, and **PWD** passengers. Generates a digital *resibo* (receipt) as proof.

### 🔍 Pasaway — Driver Lookup
Search tricycle body numbers to check if a driver has been flagged for repeated overcharging. Tricycles with **5+ reports in 30 days** are automatically flagged by the system.

### ⚠️ Bantay Batas — Community Alerts
A heatmap-style view of known tricycle terminals across Angeles City, showing report density to highlight overcharging hotspots. Helps commuters stay informed about problem areas.

### 🚩 Report Submission
Authenticated commuters can file overcharging reports with:
- Origin & destination (Google Maps autocomplete, restricted to Angeles City)
- Fare charged vs. system-calculated legal fare
- Tricycle body number
- Optional description and GPS validation

### 🛡️ Safe Ride Share
Log your ride details (body number, route, trusted contact) for personal safety tracking.

### 📊 Admin Dashboard
Admin-only panel for managing:
- **Reports** — Review, action, or dismiss pending overcharging reports
- **Users** — View and manage registered commuters
- **Terminals** — CRUD operations on tricycle terminal/hotspot locations
- **PTRO Reports** — View history of automated weekly reports sent to the PTRO
- **Dashboard Stats** — Overview of total reports, users, flagged tricycles, and terminals

### 📧 Automated PTRO Reporting
Every Sunday at 23:59, the system automatically:
1. Compiles all un-sent overcharging reports for the week
2. Generates a detailed PDF report
3. Emails the PDF to the Angeles City PTRO

---

## 🛠 Tech Stack

| Layer       | Technology                                                     |
| ----------- | -------------------------------------------------------------- |
| **Frontend** | Angular 21, TypeScript 5.9, Leaflet (maps), Angular Service Worker (PWA) |
| **Backend**  | Node.js, Express 4, JWT Authentication, bcryptjs               |
| **Database** | MySQL 8 (via mysql2)                                           |
| **Maps**     | Google Maps API (autocomplete & routing), OSRM fallback        |
| **Email**    | Nodemailer (SMTP/Gmail)                                        |
| **PDF**      | PDFKit                                                         |
| **Security** | Helmet, express-rate-limit, CORS, JWT middleware               |
| **Scheduling** | node-cron                                                   |
| **Deployment** | Netlify (frontend), Railway/Render (backend), Docker-ready   |

---

## 📁 Project Structure

```
taripa-web-app/
├── frontend/                    # Angular 21 SPA
│   ├── src/app/
│   │   ├── core/
│   │   │   ├── guards/          # Auth & admin route guards
│   │   │   ├── interceptors/    # HTTP interceptors (JWT attach)
│   │   │   ├── models/          # TypeScript interfaces
│   │   │   └── services/        # Auth, fare, driver, report, geolocation services
│   │   ├── features/
│   │   │   ├── admin/           # Admin dashboard
│   │   │   ├── auth/            # Login & registration
│   │   │   ├── bantay-batas/    # Community alert map
│   │   │   ├── home/            # Landing page
│   │   │   ├── pasaway/         # Driver lookup
│   │   │   ├── profile/         # User profile & trusted contact
│   │   │   ├── report/          # Report submission form
│   │   │   ├── resibo/          # Fare calculator & receipt
│   │   │   ├── safe-ride/       # Safe ride share
│   │   │   └── tamang-sukli/    # Change calculator
│   │   ├── shared/components/   # Reusable UI components
│   │   ├── app.component.*      # Root shell (nav, theme toggle)
│   │   ├── app.config.ts        # App providers & config
│   │   └── app.routes.ts        # Lazy-loaded route definitions
│   ├── angular.json
│   ├── ngsw-config.json         # Service worker config (PWA)
│   └── package.json
│
├── server/                      # Express REST API
│   ├── config/
│   │   └── db.js                # MySQL connection pool
│   ├── controllers/
│   │   ├── admin.controller.js  # Dashboard stats, CRUD, PTRO trigger
│   │   ├── auth.controller.js   # Register, login, profile
│   │   ├── config.controller.js # Public app config
│   │   ├── driver.controller.js # Body number lookup, flagged list
│   │   ├── fare.controller.js   # Fare calculation, ordinance, resibo
│   │   ├── report.controller.js # Submit report, safe ride log
│   │   └── route.controller.js  # Google Maps / OSRM route & distance
│   ├── middleware/
│   │   └── auth.middleware.js   # JWT verify, adminOnly guard
│   ├── routes/                  # Express route definitions
│   ├── services/
│   │   └── ptro.service.js      # Weekly PDF generation & email dispatch
│   ├── generated_reports/       # Auto-generated PTRO PDF reports
│   ├── schema.sql               # Full database schema with seeds
│   ├── seed-admin.js            # Admin account seeder
│   ├── index.js                 # App entry point
│   ├── .env                     # Environment variables
│   └── package.json
│
├── netlify.toml                 # Netlify deployment config
└── README.md
```

---

## 📋 Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 10
- **MySQL** ≥ 8.0
- **Google Maps API Key** (for autocomplete & directions — optional, falls back to OSRM)
- **Gmail App Password** (for PTRO email reports — optional for dev)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/jarenkendrick14/taripa-web-app.git
cd taripa-web-app
```

### 2. Set Up the Database

```bash
mysql -u root -p < server/schema.sql
```

This creates the `taripa_db` database with all tables, indexes, stored procedures, and seed data (fare ordinances and terminal locations).

### 3. Configure Environment Variables

Copy and edit the server `.env` file:

```bash
cp server/.env.example server/.env   # or edit server/.env directly
```

See [Environment Variables](#-environment-variables) for the full list.

### 4. Install Dependencies & Start the Backend

```bash
cd server
npm install
npm run dev          # starts with nodemon on port 3000
```

### 5. Seed the Admin Account

```bash
cd server
node seed-admin.js
```

### 6. Install Dependencies & Start the Frontend

```bash
cd frontend
npm install
npm start            # Angular dev server on port 4200
```

### 7. Open the App

Navigate to **http://localhost:4200** in your browser.

---

## 🔑 Environment Variables

All backend configuration lives in `server/.env`:

| Variable             | Description                              | Default                        |
| -------------------- | ---------------------------------------- | ------------------------------ |
| `PORT`               | Server port                              | `3000`                         |
| `NODE_ENV`           | Environment mode                         | `development`                  |
| `DB_HOST`            | MySQL host                               | `localhost`                    |
| `DB_PORT`            | MySQL port                               | `3306`                         |
| `DB_USER`            | MySQL user                               | `root`                         |
| `DB_PASSWORD`        | MySQL password                           | *(empty)*                      |
| `DB_NAME`            | MySQL database name                      | `taripa_db`                    |
| `JWT_SECRET`         | Secret key for JWT signing               | *(change in production!)*      |
| `JWT_EXPIRES_IN`     | Token expiration                         | `7d`                           |
| `SMTP_HOST`          | SMTP server for email                    | `smtp.gmail.com`               |
| `SMTP_PORT`          | SMTP port                                | `587`                          |
| `SMTP_USER`          | SMTP email address                       | —                              |
| `SMTP_PASS`          | SMTP app password                        | —                              |
| `PTRO_EMAIL`         | Recipient for weekly PTRO reports        | —                              |
| `REPORT_FROM_EMAIL`  | "From" address on report emails          | `reports@taripa.app`           |
| `GOOGLE_MAPS_API_KEY`| Google Maps API key (optional)           | *(falls back to OSRM)*         |
| `FRONTEND_URL`       | Allowed CORS origin                      | `http://localhost:4200`        |

---

## 🗄 Database Setup

The full schema is defined in [`server/schema.sql`](server/schema.sql). Key tables:

| Table               | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `users`             | Commuter & admin accounts with JWT auth                    |
| `fare_ordinances`   | Fare matrix by passenger type (regular/student/senior/pwd) |
| `tricycles`         | Body number registry with auto-flagging                    |
| `driver_reports`    | Overcharging incident reports with GPS data                |
| `terminals`         | Known tricycle terminal/hotspot locations                   |
| `terminal_alerts`   | Aggregated report counts per terminal (7-day window)       |
| `safe_ride_logs`    | Ride-share safety logs                                     |
| `ptro_reports`      | Weekly PTRO report tracking (generated/sent/failed)        |
| `fare_calculations` | Fare calculation history log                               |

### Stored Procedures

- **`RefreshTricycleFlags()`** — Auto-flags tricycles with 5+ reports in the last 30 days (runs hourly)
- **`RefreshTerminalAlerts()`** — Aggregates report counts near terminals for the last 7 days (runs hourly)

---

## 📡 API Reference

**Base URL:** `http://localhost:3000/api`

### Authentication
| Method | Endpoint                    | Auth     | Description                    |
| ------ | --------------------------- | -------- | ------------------------------ |
| POST   | `/auth/register`            | Public   | Register a new commuter        |
| POST   | `/auth/login`               | Public   | Login and receive JWT          |
| GET    | `/auth/me`                  | JWT      | Get current user profile       |
| PATCH  | `/auth/trusted-contact`     | JWT      | Update trusted contact info    |

### Fare
| Method | Endpoint                          | Auth     | Description                        |
| ------ | --------------------------------- | -------- | ---------------------------------- |
| GET    | `/fare/ordinance`                 | Public   | Get active fare ordinance          |
| POST   | `/fare/calculate`                 | Public   | Calculate fare for a route         |
| POST   | `/fare/resibo/:calculationId`     | JWT      | Mark a calculation as resibo'd     |
| GET    | `/fare/terminals`                 | Public   | Get all terminal locations         |
| GET    | `/fare/my-history`                | JWT      | Get user's fare calculation history|

### Drivers
| Method | Endpoint                     | Auth     | Description                        |
| ------ | ---------------------------- | -------- | ---------------------------------- |
| GET    | `/drivers/lookup/:bodyNumber`| Public   | Look up a tricycle by body number  |
| GET    | `/drivers/flagged`           | Public   | Get all flagged tricycles          |
| GET    | `/drivers/search`            | Public   | Search drivers by query            |

### Reports
| Method | Endpoint                     | Auth     | Description                        |
| ------ | ---------------------------- | -------- | ---------------------------------- |
| POST   | `/reports/submit`            | JWT      | Submit an overcharging report      |
| GET    | `/reports/my`                | JWT      | Get current user's reports         |
| POST   | `/reports/safe-ride`         | JWT      | Log a safe ride share              |
| GET    | `/reports/admin/pending`     | Admin    | Get pending reports (admin only)   |

### Route
| Method | Endpoint | Auth   | Description                              |
| ------ | -------- | ------ | ---------------------------------------- |
| GET    | `/route` | Public | Get route/distance between two GPS points|

### Config
| Method | Endpoint  | Auth   | Description                |
| ------ | --------- | ------ | -------------------------- |
| GET    | `/config` | Public | Get public app config      |

### Admin *(all require admin JWT)*
| Method | Endpoint                     | Description                          |
| ------ | ---------------------------- | ------------------------------------ |
| GET    | `/admin/stats`               | Dashboard statistics                 |
| GET    | `/admin/reports`             | All reports (filterable)             |
| PATCH  | `/admin/reports/:id/status`  | Update report status                 |
| GET    | `/admin/users`               | List all users                       |
| PUT    | `/admin/users/:id`           | Update a user                        |
| DELETE | `/admin/users/:id`           | Delete a user                        |
| GET    | `/admin/terminals`           | List terminals                       |
| POST   | `/admin/terminals`           | Create a terminal                    |
| PUT    | `/admin/terminals/:id`       | Update a terminal                    |
| DELETE | `/admin/terminals/:id`       | Delete a terminal                    |
| GET    | `/admin/ptro`                | PTRO report history                  |
| POST   | `/admin/ptro/trigger`        | Manually trigger a PTRO report       |

### Health Check
| Method | Endpoint       | Description                     |
| ------ | -------------- | ------------------------------- |
| GET    | `/api/health`  | Server & database status check  |

---

## ⏰ Scheduled Jobs

| Schedule              | Job                         | Description                                              |
| --------------------- | --------------------------- | -------------------------------------------------------- |
| Every Sunday 23:59    | PTRO Weekly Report          | Generates PDF of week's reports and emails it to PTRO    |
| Every hour (`:00`)    | RefreshTricycleFlags        | Flags tricycles with 5+ reports in the last 30 days      |
| Every hour (`:00`)    | RefreshTerminalAlerts       | Aggregates report counts near each terminal (7-day window)|

---

## 🌐 Deployment

### Frontend (Netlify)

The frontend is configured for deployment via [Netlify](https://netlify.com) using `netlify.toml`:

- **Build base:** `frontend`
- **Build command:** `npm run build -- --configuration production`
- **Publish directory:** `dist/taripa-frontend/browser`
- SPA redirect rules are included for Angular routing.

### Backend (Railway / Render / Docker)

The backend includes:
- **`Procfile`** — `web: node index.js` (for Heroku/Railway)
- **`Dockerfile`** — Minimal Node.js container image
- **`nixpacks.toml`** — For Railway auto-detection

Set all environment variables from the [table above](#-environment-variables) in your hosting provider's dashboard.

---

## 🔐 Default Admin Credentials

After running `node seed-admin.js`:

| Field      | Value               |
| ---------- | ------------------- |
| **Email**  | `admin@taripa.app`  |
| **Password** | `admin123`        |

> ⚠️ **Change these immediately in production!**

---

## 📄 License

This project is developed for academic and civic purposes for Angeles City, Pampanga.

---

<p align="center">
  <strong>🛺 TARIPA</strong> — <em>Know the fare. Report the abuse. Protect the commuter.</em>
</p>
