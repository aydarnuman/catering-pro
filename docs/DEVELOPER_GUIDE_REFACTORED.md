# 👨‍💻 Developer Guide - Refactored Menu Planning System

> **For Developers:** Working with the new modular menu planning architecture  
> **Updated:** 1 Şubat 2026  
> **Difficulty:** Beginner → Intermediate

---

## 🎯 **QUICK START**

### **Understanding the New Architecture:**

```
🏗️ OLD WAY (Before Refactor):
├─ Single file: page.tsx (2868 lines)
├─ Everything mixed together
├─ Hard to debug and maintain
└─ 8 hours to understand

🚀 NEW WAY (After Refactor):
├─ 5 focused files (~300 lines each)
├─ Clear separation of concerns
├─ Easy to debug and extend
└─ 30 minutes to understand each part
```

---

## 📁 **FILE STRUCTURE GUIDE**

### **Where to Find What:**

```typescript
app/muhasebe/menu-planlama/
├─ layout.tsx                    // 🔧 MODIFY: For layout changes, error boundaries
├─ page.tsx                      // 🔧 MODIFY: For navigation, tab routing  
├─ yemekler/page.tsx            // 🔧 MODIFY: For meal selection features
├─ receteler/page.tsx           // 🔧 MODIFY: For recipe management features
├─ fiyat-analizi/page.tsx       // 🔧 MODIFY: For price analysis wrapper
└─ components/
   ├─ MenuPlanlamaContext.tsx   // 🔧 MODIFY: For shared state changes
   ├─ FiyatYonetimiTab.tsx      // 🔧 EXISTING: Price management (legacy)
   └─ KategoriGrid.tsx          // 🔧 NEW: Extracted category component
```

### **Common Developer Tasks:**

#### **🍽️ Adding New Meal Category:**
```typescript
// 1️⃣ Update backend data
// INSERT INTO recete_kategoriler (kod, ad, ikon) VALUES ('yeni', 'Yeni Kategori', '🆕')

// 2️⃣ Frontend automatically picks it up via useReceteKategorileri()
// No frontend code change needed!

// 📍 File to check: hooks/useReceteKategorileri.ts
```

#### **📝 Adding Recipe Feature:**
```typescript
// 📍 Modify: receteler/page.tsx

// Add new state
const [newFeatureState, setNewFeatureState] = useState();

// Add new API call
const { data: newData } = useQuery({
  queryKey: ['new-feature'],
  queryFn: () => menuPlanlamaAPI.newFeature(),
});

// Add UI component
<NewFeatureComponent data={newData} />
```

#### **💰 Adding Price Analysis Feature:**
```typescript
// 📍 Modify: components/FiyatYonetimiTab.tsx
// This component handles all price-related features
// Add new tabs, charts, or analysis tools here
```

#### **🛒 Modifying Cart Behavior:**
```typescript
// 📍 Modify: components/MenuPlanlamaContext.tsx

// Add new cart functions:
const handleBulkAdd = useCallback((items: SeciliYemek[]) => {
  setSeciliYemekler(prev => [...prev, ...items]);
}, [setSeciliYemekler]);

// Export in context value:
const value = {
  // ... existing values
  handleBulkAdd,
};
```

---

## 🔌 **API INTEGRATION PATTERNS**

### **Adding New API Endpoint:**

#### **1️⃣ Backend (Express.js):**
```javascript
// 📁 backend/src/routes/menu-planlama.js
router.get('/new-endpoint', async (req, res) => {
  try {
    const result = await query('SELECT * FROM table');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### **2️⃣ Frontend Service:**
```typescript
// 📁 frontend/src/lib/api/services/menu-planlama.ts
async getNewData(): Promise<ApiResponse<DataType[]>> {
  const response = await api.get('/api/menu-planlama/new-endpoint');
  return response.data;
}
```

#### **3️⃣ Frontend Component:**
```typescript
// 📁 Any page.tsx file
const { data: newData, isLoading } = useQuery({
  queryKey: ['new-data'],
  queryFn: () => menuPlanlamaAPI.getNewData(),
  staleTime: 2 * 60 * 1000,
});
```

### **Error Handling Pattern:**
```typescript
// Always wrap API calls with error handling
const { data, isLoading, error } = useQuery({
  queryKey: ['data-key'],
  queryFn: async () => {
    const result = await apiCall();
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }
    return result.data;
  },
  onError: (error) => {
    notifications.show({
      title: 'Hata',
      message: error.message,
      color: 'red'
    });
  }
});
```

---

## 🧪 **TESTING GUIDELINES**

### **Component Testing:**
```typescript
// Test individual components in isolation
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import YemeklerPage from './yemekler/page';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

test('renders category grid', () => {
  render(
    <QueryClientProvider client={queryClient}>
      <MenuPlanlamaProvider>
        <YemeklerPage />
      </MenuPlanlamaProvider>
    </QueryClientProvider>
  );
  
  expect(screen.getByText('Yemek Kategorileri')).toBeInTheDocument();
});
```

### **API Testing:**
```bash
# Test all critical endpoints
curl http://localhost:3001/api/menu-planlama/kategoriler
curl http://localhost:3001/api/menu-planlama/receteler?limit=5
curl http://localhost:3001/api/maliyet-analizi/ozet
curl http://localhost:3001/api/fiyat-yonetimi/dashboard
```

### **Manual Testing Checklist:**
```
✅ FUNCTIONALITY:
├─ [ ] Tab navigation works smoothly
├─ [ ] Category popover/drawer opens correctly
├─ [ ] Cart add/remove functions properly
├─ [ ] Recipe detail modal shows data
├─ [ ] AI ingredient suggestion works
├─ [ ] Price charts render correctly
└─ [ ] Mobile responsive design

✅ PERFORMANCE:
├─ [ ] Page loads under 2 seconds
├─ [ ] Tab switching is instant
├─ [ ] No unnecessary re-renders
├─ [ ] Memory usage stable
└─ [ ] API calls are cached appropriately
```

---

## 🐛 **DEBUGGING GUIDE**

### **Common Issues & Solutions:**

#### **❌ "Context value is undefined"**
```typescript
// Problem: Component outside MenuPlanlamaProvider
// Solution: Wrap component with provider or move inside layout

// ❌ Wrong:
<SomeComponent /> // Outside provider

// ✅ Correct:
<MenuPlanlamaProvider>
  <SomeComponent />
</MenuPlanlamaProvider>
```

#### **❌ "Query key does not exist"**
```typescript
// Problem: Typo in queryKey or queryFn not returning data
// Solution: Check queryKey consistency and API response

// ❌ Wrong:
queryKey: ['recete-kategoriler'] // different spelling

// ✅ Correct:
queryKey: ['recete-kategorileri'] // consistent with hook
```

#### **❌ "API returns success: false"**
```typescript
// Problem: Backend validation error or missing data
// Solution: Check backend logs and validate request params

// Debug API call:
console.log('API Request:', params);
console.log('API Response:', response);
```

### **Performance Debugging:**

#### **🐌 Slow Rendering:**
```typescript
// Use React DevTools Profiler:
// 1. Check for unnecessary re-renders
// 2. Add React.memo to heavy components
// 3. Verify useMemo/useCallback usage

// Quick fix:
const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});
```

#### **🐌 Slow API Calls:**
```typescript
// Check network tab in DevTools:
// 1. Identify slow endpoints
// 2. Verify caching is working  
// 3. Check if data can be paginated

// Quick fix - add caching:
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5 minute cache
});
```

---

## 📋 **CODING STANDARDS**

### **Component Creation:**
```typescript
// Template for new components:
import React from 'react';
import { /* Mantine components */ } from '@mantine/core';

interface ComponentProps {
  // Define props with TypeScript
}

export const ComponentName = React.memo(({ ...props }: ComponentProps) => {
  // Component logic
  
  return (
    // JSX
  );
});
```

### **Hook Creation:**
```typescript
// Template for custom hooks:
export function useFeatureName(params: ParamsType) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature-key', params],
    queryFn: async () => {
      // API logic
    },
    staleTime: 2 * 60 * 1000,
  });

  const processedData = useMemo(() => {
    // Data processing logic
  }, [data]);

  return {
    data: processedData,
    isLoading,
    error,
    // ... other exports
  };
}
```

### **State Management:**
```typescript
// Use Context for shared state:
// ✅ Cart data, user preferences, global settings

// Use local useState for:
// ✅ UI state, form inputs, modals

// Use React Query for:
// ✅ Server state, API data, caching
```

---

## 🚀 **DEPLOYMENT CHECKLIST**

### **Pre-Deployment:**
```bash
# 1. Run tests
npm run test

# 2. Type checking
npm run type-check

# 3. Build verification
npm run build

# 4. API endpoint verification
curl http://localhost:3001/api/menu-planlama/kategoriler

# 5. Performance check
npm run analyze  # if available
```

### **Post-Deployment:**
```bash
# 1. Verify routes
curl https://catering-tr.com/muhasebe/menu-planlama

# 2. Check error logs
pm2 logs catering-frontend

# 3. Monitor performance
# Use browser DevTools to verify bundle sizes
```

---

## 🎯 **BEST PRACTICES**

### **DO's:**
- ✅ Use TypeScript for all new components
- ✅ Apply React.memo for heavy components
- ✅ Use React Query for API calls
- ✅ Follow existing folder structure
- ✅ Add error boundaries for new features
- ✅ Test on both desktop and mobile
- ✅ Use shared context for cross-tab data

### **DON'Ts:**
- ❌ Don't bypass the context for shared state
- ❌ Don't make direct API calls without error handling
- ❌ Don't create new state patterns (use established ones)
- ❌ Don't skip TypeScript interfaces
- ❌ Don't forget mobile responsive design
- ❌ Don't modify layout.tsx unless necessary
- ❌ Don't break tab navigation logic

---

## 📞 **SUPPORT & RESOURCES**

### **Documentation Links:**
- **API Reference:** [REFACTORED_API_GUIDE.md](./REFACTORED_API_GUIDE.md)
- **Architecture:** [MENU_PLANLAMA_REFACTOR.md](./MENU_PLANLAMA_REFACTOR.md)
- **Original System:** [03_FRONTEND_MODULES.md](./03_FRONTEND_MODULES.md)

### **Quick Commands:**
```bash
# Development
cd frontend && npm run dev

# Testing
npm run build && npm run start

# API testing
cd backend && npm run dev
```

**🎉 Happy coding with the new modular architecture!** 🚀