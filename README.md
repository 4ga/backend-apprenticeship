# Backend Apprenticeship - Node.js, TypeScript, SQLite, Auth

###### A structured backend engineering apprenticeship progressing from HTTP fundamentals to authenticated, multi-tenant APIs with persistent storage and token-based authentication.

#### This repository documents my step-by-step journey from backend fundamentals to production-style API design. Each project builds directly on the previous one, emphasizing correctness, clarity, testing, and real-world patterns.
# 
### 🧭 Learning Philosophy

- No copy-paste tutorials

- Each concept implemented from first principles

- Incremental complexity

- Tests drive design

- Production constraints introduced gradually

- Every project explains why, not just how

#
### 🛠 Tech Stack

- Language: TypeScript

- Runtime: Node.js

- Framework: Express

- Database: SQLite

- Auth: JWT (access + refresh tokens)

- Hashing: bcrypt

- Testing: Vitest

- HTTP Testing: Supertest

- Tooling: dotenv, sqlite, jsonwebtoken
#
### 📁 Project Structure
```
backend-apprenticeship/
├─ p01-http-basics/
├─ p02-express-routing/
├─ p03-errors-and-middleware/
├─ p04-in-memory-todos/
├─ p05-sqlite-persistence/
├─ p06-authentication/
├─ p07-auth-protected-todos/
└─ README.md
```

Each project is self-contained and builds on prior concepts.
#
### 📚 Projects Overview

P01 – HTTP & Server Fundamentals

#### Focus:

- HTTP methods

- Request / response lifecycle

- Status codes

- JSON APIs

#### Key Concepts:

- Stateless communication

- API contracts

- Basic server health endpoints

#
### P02 – Express Routing & Controllers

#### Focus:

- Express routing

- Controllers

- Request parsing

- RESTful conventions

#### Key Concepts:

- Separation of concerns

- Route structure

- Express middleware flow

#
### P03 – Errors, Validation & Middleware

#### Focus:

- Custom error types

- Centralized error handling

- Request validation

#### Key Concepts:

- Error propagation

- HTTP error semantics

- Defensive API design

#
### P04 – In-Memory Todo API

#### Focus:

- CRUD operations

- Domain modeling

- Business logic isolation

#### Key Concepts:

- Pure functions vs side effects

- Patch semantics

- Deterministic behavior

#
### P05 – SQLite Persistence

#### Focus:

- Persistent storage

- SQL queries

- Pagination & filtering

#### Key Concepts:

- Schema design

- Indexing

- Data consistency

- Repository pattern

#
### P06 – Authentication System

#### Focus:

- User registration & login

- Password hashing

- JWT access + refresh tokens

#### Key Concepts:

- Authentication vs authorization

- Token expiry & rotation

- Session revocation

- Secure credential handling

# 
### P07 – Auth-Protected Multi-Tenant Todos

#### Focus:

- Per-user data isolation

- Protected routes

- Logout-all functionality

#### Key Concepts:

- Multi-tenant security

- Ownership enforcement

- Token-based authorization

- Production-style API behavior

#
### 🧪 Testing Strategy

- All projects include automated tests

- Tests assert behavior, not implementation

- Auth flows tested end-to-end

- Edge cases explicitly covered

#### Example:

- Invalid credentials

- Token rotation

- Unauthorized access

- Cross-user isolation

### 🔐 Security Practices

- Passwords hashed with bcrypt

- Refresh tokens stored server-side

- Token rotation enforced

- Logout-all invalidates active sessions

- No sensitive data leaked in responses

#

### 📈 Progression Summary

| Project | Persistence | Auth | Multi-user | Production Patterns |
| ------- | ----------- | ---- | ---------- | ------------------- |
| P01     | ❌           | ❌    | ❌          | ❌               |
| P04     | ❌           | ❌    | ❌          | ⚠️               |
| P05     | ✅           | ❌    | ❌          | ✅               |
| P06     | ✅           | ✅    | ❌          | ✅               |
| P07     | ✅           | ✅    | ✅          | ✅               |

#
### 🚀 Next Steps

#### Planned future projects:

- P08: Role-based authorization (RBAC)

- P09: Service decomposition (Auth service vs Todo service)

- P10: Observability, logging, rate limiting

- P11+: Production deployment & scaling patterns

#
### 👤 About This Repository

This repository represents a deliberate backend engineering apprenticeship, focused on building professional instincts, not just features.

#### Each decision prioritizes:

- Maintainability

- Correctness

- Security

- Real-world applicability

#
### 📄 License

MIT