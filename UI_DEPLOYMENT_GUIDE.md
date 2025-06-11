# 🎛️ UI Deployment Guide

This guide explains the different ways to deploy the Proxy Stone Web UI.

## 🏗️ **Architecture Options**

### **Option 1: Standalone Development (Recommended for Development)**
```
┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   Backend API   │
│   (React App)   │◄──►│  (Fastify App)  │
│   Port: 3000    │    │   Port: 4006    │
└─────────────────┘    └─────────────────┘
```

**Benefits:**
- ✅ Hot reload during development
- ✅ Independent scaling
- ✅ Better performance (can use CDN)
- ✅ Technology independence

**Setup:**
```bash
# Terminal 1: Start Backend
cd apps/backend
npm run dev

# Terminal 2: Start UI
cd apps/ui  
npm run dev
```

Access: `http://localhost:3000` (UI) + `http://localhost:4006` (API)

### **Option 2: Integrated Deployment (Production)**
```
┌─────────────────────────────────┐
│         Backend API             │
│  ┌─────────────────┐           │
│  │   Static UI     │           │
│  │   (Built React) │           │
│  └─────────────────┘           │
│         Port: 4006              │
└─────────────────────────────────┘
```

**Benefits:**
- ✅ Single deployment
- ✅ No CORS issues
- ✅ Simplified hosting

**Setup:**
```bash
# Build UI
cd apps/ui
npm run build

# Restart Backend (will auto-detect UI build)
cd apps/backend
npm run dev
```

Access: `http://localhost:4006/ui`

### **Option 3: Static Hosting (Production)**
Deploy UI to Vercel/Netlify and configure API endpoint.

## 🔧 **Current Implementation**

### **Backend Routes:**
- `/` - Landing page with navigation
- `/ui` - UI placeholder or built app
- `/api/ui/status` - Check UI deployment status
- `/docs` - API documentation

### **UI Status Detection:**
The backend automatically detects if the UI build exists:
- **Build found**: Serves UI at `/ui` 
- **No build**: Shows development placeholder

### **Environment Variables:**
```env
# UI Configuration (when standalone)
VITE_API_URL=http://localhost:4006

# Backend Configuration  
CORS_ORIGIN=http://localhost:3000
```

## 🚀 **Deployment Strategies**

### **Development:**
1. Run both services separately
2. Use hot reload for fast development
3. Backend serves API + docs, UI serves interface

### **Staging/Testing:**
1. Build UI and integrate with backend
2. Single service for easier testing
3. Test full integration

### **Production:**
Choose based on requirements:

- **High Traffic**: Static hosting (Vercel) + API server
- **Simple Deployment**: Integrated mode
- **Enterprise**: Kubernetes with separate services

## 🎯 **Recommendation**

**For Development:** Use standalone mode for best developer experience.

**For Production:** 
- **Small/Medium Apps**: Use integrated deployment
- **Large Scale Apps**: Use static hosting + separate API

The current implementation supports both seamlessly! 🚀

## 📊 **Status Endpoints**

Check deployment status:
```bash
# Check UI availability
curl http://localhost:4006/api/ui/status

# Check overall service health  
curl http://localhost:4006/health
```

## 🔗 **URLs Summary**

| Mode | Landing | UI | API | Docs |
|------|---------|----|----|------|
| Development | `:4006/` | `:3000` | `:4006/api/*` | `:4006/docs` |
| Integrated | `:4006/` | `:4006/ui` | `:4006/api/*` | `:4006/docs` |
| Static Hosting | `:4006/` | `ui.domain.com` | `:4006/api/*` | `:4006/docs` |

Perfect for any deployment scenario! 🎉