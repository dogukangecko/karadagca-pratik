# Security Policy

## Supported Versions

The following versions are currently being supported with security updates:

| Component / Module                  | Version        | Supported          |
|------------------------------------|----------------|--------------------|
| Backend (Node.js + Express)        | 5.1.x          | ✅                 |
| Backend (Node.js + Express)        | 5.0.x          | ❌                 |
| Backend (Node.js + Express)        | 4.0.x          | ✅                 |
| Frontend (React + react-scripts)   | 0.1.x          | ✅                 |
| Other dependencies                 | —              | Partial (see below)|

> ⚠️ Dependencies are regularly audited using `npm audit`. Known vulnerabilities are patched or mitigated as soon as updates are available.

## Reporting a Vulnerability

If you find a vulnerability in this project, **please report it responsibly**.

### 🔐 How to Report

- 📧 Email: `legal@geckotech.me` *(ya da kendi adresin)*
- 🐛 You can also create a **Private GitHub Security Advisory** if applicable
- 🚫 Please do **not** disclose vulnerabilities publicly before we have addressed them

### ⏱️ What to Expect

- We aim to **respond within 72 hours**
- Verified vulnerabilities will be **patched as soon as possible**
- You will be notified when:
  - The vulnerability is confirmed
  - A fix is released
  - Or the issue is rejected (with reason)

---

### 🔒 Additional Security Practices

- Uses `express-validator` to sanitize input
- Passwords hashed with `bcrypt` or `bcryptjs`
- JWT authentication via `jsonwebtoken`
- Environment variables managed with `dotenv`
- MySQL access via parameterized queries (`mysql2`)

---
