# 📍 @codecot/proxy-stone Roadmap

A structured roadmap for the continued evolution of `@codecot/proxy-stone`, now that the core proxy infrastructure is stable and production-ready.

---

## ✅ Completed Phases (MVP+)

| Phase | Title                              | Status      |
| ----- | ---------------------------------- | ----------- |
| 1     | Core Proxy Forwarding              | ✅ Complete |
| 2     | Multi-Layer Caching (Memory/Redis) | ✅ Complete |
| 3     | Logging & Observability            | ✅ Complete |
| 4     | Robust Error Handling              | ✅ Complete |
| 5     | Snapshot & TTL Management          | ✅ Complete |
| 6     | Advanced Metrics & Monitoring      | ✅ Complete |
| 7     | Multi-Database Support (MySQL/PG)  | ✅ Complete |
| 8     | Cache Management API               | ✅ Complete |
| 9     | Configuration & CLI Support        | ✅ Complete |
| 10    | Docker + Dev Profiles              | ✅ Complete |

---

## 🚀 Post-MVP Enhancements

### 🔐 Phase 11: Access Control & API Security

- [ ] Add API key auth support (optional, per environment)
- [ ] Role-based access control for endpoints (admin, read-only, etc.)
- [ ] Protect internal APIs with JWT / OAuth2

---

### 🖥️ Phase 12: Web Admin UI (React SPA)

- [ ] View/manage cache entries
- [ ] TTL overrides and snapshot refresh
- [ ] Analytics: error, cache, performance views
- [ ] Backend status + live metrics

---

### 🧠 Phase 13: AI-Assisted Debugging & Drift Detection

- [ ] Auto-alert on structure changes (OpenAPI diff)
- [ ] Suggest performance optimization hints
- [ ] Log analysis using LLMs (natural language logs summary)

---

### 🧪 Phase 14: Integration Testing Framework

- [ ] End-to-end proxy → backend → cache validation
- [ ] TTL behavior assertions
- [ ] Metrics test coverage (response time, hits, errors)

---

### ⚙️ Phase 15: Plugin System

- [ ] Dynamic plugin loading from `/plugins`
- [ ] Custom routing logic per domain
- [ ] Request/response mutation hooks

---

### 🌍 Phase 16: Distributed Deployment & Sync

- [ ] Run in clustered mode (multi-node)
- [ ] Use Redis Pub/Sub or DB sync for snapshot metadata
- [ ] Leader/follower mode (optional)

---

### 📦 Phase 17: Packaging & Public Distribution

- [ ] CLI version (`npx proxy-stone`)
- [ ] Config-based standalone deployment
- [ ] `@codecot/proxy-stone` npm package
- [ ] GitHub Releases w/ binaries (Docker, zip, etc.)

---

## ✏️ Contributing

To contribute to any item above, open a GitHub issue with the tag `enhancement` or start a discussion.

Want to suggest a new phase? File an idea under [Discussions](https://github.com/codecot/proxy-stone/discussions).

---
