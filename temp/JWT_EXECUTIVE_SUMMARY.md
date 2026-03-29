# JWT & Registration Flow - Executive Summary 🎯

## What You Asked For
> "Check JWT, tell me what fields to add, prepare routes for registration flow"

## What I Provided

### 📋 Documents Created (in `/temp` folder)

| Document | Purpose |
|----------|---------|
| **JWT_QUICK_REFERENCE.md** | ⭐ START HERE - 2-page quick summary |
| **JWT_FIELDS_AND_ROUTES.md** | 📖 Complete detailed guide (10 pages) |
| **JWT_BEFORE_AFTER.md** | 🔄 Side-by-side comparison of changes |
| **JWT_CODE_IMPLEMENTATION.md** | 💻 Copy-paste ready code (all 6 files) |

---

## TL;DR - What to Add to JWT

### Current JWT (3 fields)
```json
{
  "id": "user_id",
  "email": "user@email.com",
  "role": "ADMIN"
}
```

### Add These 7 Fields
```json
{
  "id": "user_id",
  "email": "user@email.com",
  "role": "ADMIN",
  
  "companyId": "company_id",           ← CRITICAL for multi-tenant
  "designation": "DIRECTOR",            ← Job title for approvals
  "firstName": "John",                  ← Display name
  "lastName": "Doe",                    ← Display name
  "isManager": true,                    ← Can manage employees?
  "isApprover": true,                   ← Can approve expenses?
  "managerId": null                     ← Who is their manager?
}
```

---

## Why These Fields?

| Field | Why | Usage |
|-------|-----|-------|
| **companyId** | Multi-tenant isolation | Filter all queries by company |
| **designation** | Approval authority levels | Route approvals (DIRECTOR vs FINANCE) |
| **firstName/lastName** | Display in UI | "Welcome, John Doe" |
| **isManager** | Permission flag | Show "Manage Employees" button |
| **isApprover** | Permission flag | Show "Pending Approvals" tab |
| **managerId** | Organization structure | Show team members |

---

## Registration Flow (Auto-Company Creation)

### User Journey
```
1. User visits app
   ↓
2. Selects country (dropdown)
   ↓
3. Enters: email, password, firstName, companyName
   ↓
4. Clicks Register
   ↓
5. AUTO-CREATES:
   ✅ Company (with selected country + auto-fetched currency)
   ✅ Admin Employee (linked to company)
   ✅ Default Expense Categories
   ✅ Default Approval Rules
   ✅ Company Settings
   ↓
6. Returns JWT + refreshToken
   ↓
7. User logged in!
```

---

## Files to Modify/Create

### 🔧 Modify 2 Files

1. **`src/utils/auth.js`** (Line 18-27)
   - Update `generateToken()` function
   - Add 7 new fields to JWT payload
   - Takes 2 minutes

2. **`src/middleware/verify.middleware.js`** (All content)
   - Extract `companyId` from decoded token
   - Add to `req.companyId` for easy access
   - Takes 2 minutes

### ✨ Create 3 New Files

3. **`src/middleware/designation.middleware.js`** (NEW)
   - 5 middleware functions for designation-based auth
   - Copy-paste ready
   - Takes 5 minutes

4. **`src/controllers/auth.controller.js`** (NEW)
   - Register (with company auto-creation)
   - Login
   - RefreshToken
   - Logout
   - Copy-paste ready
   - Takes 5 minutes

5. **`src/routes/auth.routes.js`** (NEW)
   - 5 endpoints (register, login, refresh, logout, me)
   - Copy-paste ready
   - Takes 3 minutes

### 📝 Update 1 Configuration File

6. **`src/index.js`** (Already exists)
   - Import new auth routes
   - Mount routes
   - Takes 2 minutes

---

## Quick Implementation Timeline

```
Total Time: ~20 minutes

✅ 2 min  - Read JWT_QUICK_REFERENCE.md
✅ 2 min  - Update auth.js (generateToken)
✅ 2 min  - Update verify.middleware.js  
✅ 5 min  - Create designation.middleware.js
✅ 5 min  - Create auth.controller.js
✅ 3 min  - Create auth.routes.js
✅ 2 min  - Update index.js
✅ 2 min  - npm install bcrypt (if needed)
✅ 1 min  - Test endpoints

TOTAL: 24 minutes to full implementation
```

---

## What Happens After Implementation

### User Registration Flow
```
POST /api/auth/register
{
  email: "admin@acme.com",
  password: "SecurePass123",
  firstName: "John",
  lastName: "Doe",
  companyName: "Acme Corp",
  country: "India"
}

Backend does:
├─ 1. Validate input
├─ 2. Fetch "INR" currency for India
├─ 3. Create Company with:
│  ├─ name: "Acme Corp"
│  ├─ country: "India"
│  ├─ currency: "INR"
│  └─ baseCurrency: "INR"
├─ 4. Create Employee (Admin) linked to company
├─ 5. Create 5 default categories (TRAVEL, MEALS, etc.)
├─ 6. Create default approval rules
├─ 7. Generate JWT with 10 fields
├─ 8. Return tokens + user info
└─ ✅ DONE!

Response:
{
  accessToken: "eyJ...",
  refreshToken: "abc123...",
  employee: { id, email, firstName, role, designation, companyId... },
  company: { id, name, country, currency, baseCurrency }
}
```

### User Login Flow
```
POST /api/auth/login
{
  email: "admin@acme.com",
  password: "SecurePass123"
}

Backend does:
├─ 1. Find employee by email
├─ 2. Compare password hash
├─ 3. Generate new JWT with 10 fields
├─ 4. Save refresh token
└─ ✅ Return tokens + user info

No company selection needed!
(Already linked to company from registration)
```

---

## JWT Lifetime

### Access Token
- Lifespan: 7 days (configured via JWT_EXPIRY env var)
- Used for: API requests in Authorization header
- Contains: Full user context (company, designation, permissions)

### Refresh Token
- Lifespan: 30 days (hardcoded in auth.js)
- Usage: POST /api/auth/refresh to get new access token
- Storage: HTTP-only cookie or secure storage
- DB: Stored in Employee.refreshToken table

---

## Multi-Tenant Security

### Before This Implementation
```
❌ Email globally unique - conflict with multi-tenant
❌ No companyId in JWT - can't isolate data
❌ No designation-based auth - only role-based
❌ Email duplicates impossible in same system
```

### After This Implementation
```
✅ Email per company (unique: email + companyId)
✅ companyId in JWT - all queries filtered
✅ Designation-based auth - approval routing
✅ Same person, different emails in different companies
✅ Complete isolation between companies
```

---

## Example: Using JWT in Frontend

```javascript
import { jwtDecode } from 'jwt-decode';

// After login/registration
const accessToken = response.data.accessToken;
const user = jwtDecode(accessToken);

// Now you have everything in one place:
console.log(user.id);           // "cuid123"
console.log(user.email);        // "john@acme.com"
console.log(user.companyId);    // "cuid456" ← Company context!
console.log(user.role);         // "ADMIN"
console.log(user.designation);  // "DIRECTOR"
console.log(user.firstName);    // "John"
console.log(user.isApprover);   // true
console.log(user.isManager);    // true

// Use for conditional UI rendering:
if (user.isApprover) {
  showApprovalButton();
}

if (user.isManager) {
  showManageEmployeesMenu();
}

// Use for API calls:
const expenses = await fetch(
  `/api/expenses?companyId=${user.companyId}`
);
```

---

## What's NOT in JWT?

```
❌ Password (NEVER!)
❌ Refresh token (never embed)
❌ Company settings (fetch on demand)
❌ Employee list (fetch on demand)
❌ Approval workflows (fetch on demand)

✅ Only lightweight, frequently-accessed user context
```

---

## Router Examples

### Public Routes (No Auth Needed)
```javascript
POST   /api/auth/register    - Any user
POST   /api/auth/login       - Any user
POST   /api/auth/refresh     - Any user
```

### Protected Routes (Auth Needed)
```javascript
GET    /api/auth/me          - authenticateToken
POST   /api/auth/logout      - authenticateToken
GET    /api/employees        - authenticateToken + authorizeRole("ADMIN", "MANAGER")
GET    /api/approvals        - authenticateToken + authorizeApprover
POST   /api/expenses/{id}/approve - authenticateToken + authorizeDesignation("DIRECTOR", "CFO")
```

---

## Database Schema Already Ready ✅

The Prisma schema is **ALREADY CREATED** with:

```
✅ Company model (country, currency)
✅ Employee model (updated with companyId, designation, isManager, isApprover)
✅ Expense model
✅ ApprovalRule model
✅ ApprovalStep model (requiring designation)
✅ ApprovalCondition model
✅ ApprovalHistory model
✅ CompanySettings model
✅ ExpenseCategory model
✅ All relationships configured
✅ All indexes added
✅ All constraints set
✅ Prisma client generated
```

**No migrations needed!** Just implement the routes.

---

## Environment Variables Needed

```env
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRY=7d
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

---

## Dependencies

```bash
# Already have
npm install express
npm install cors

# Need to add
npm install bcrypt      # For password hashing
npm install jsonwebtoken # For JWT (might need to add if not there)

# Frontend (optional, for development)
npm install jwt-decode  # For decoding JWT in browser
```

---

## Testing Checklist

After implementation, verify:

- [ ] `npm run dev` or `node src/index.js` starts without errors
- [ ] POST /api/auth/register works and creates company
- [ ] Company record created with correct currency
- [ ] Employee record created as ADMIN
- [ ] 5 expense categories created
- [ ] Approval rule created with 3 steps
- [ ] JWT token returned contains all 10 fields
- [ ] POST /api/auth/login works with created account
- [ ] POST /api/auth/me returns user from JWT
- [ ] POST /api/auth/refresh works with refresh token
- [ ] POST /api/auth/logout clears refresh token
- [ ] Protected route rejects without token
- [ ] authorizeApprover middleware works
- [ ] authorizeDesignation middleware works
- [ ] verifyCompanyAccess middleware works

---

## Next Steps After This

Once JWT implementation is done:

1. ✅ JWT & Auth setup (THIS DOCUMENT)
2. ⏳ Employee Management routes (create, list, update, assign manager)
3. ⏳ Expense submission routes (create, list, update)
4. ⏳ Approval workflow routes (get pending, approve, reject)
5. ⏳ Admin configuration routes (manage rules, categories, employees)
6. ⏳ Frontend integration with JWT
7. ⏳ Protected route wrappers in frontend
8. ⏳ Testing & deployment

---

## Document Guide

### 📍 For Quick Reference
Start with: **JWT_QUICK_REFERENCE.md**
- 2 pages
- Visual
- Summary of changes

### 📍 For Complete Understanding
Read: **JWT_FIELDS_AND_ROUTES.md**
- 10+ pages
- Detailed explanations
- Complete controller logic
- Route examples

### 📍 For Visual Comparison
Check: **JWT_BEFORE_AFTER.md**
- Side-by-side comparisons
- Shows what changes and why
- Security improvements

### 📍 For Just Coding
Use: **JWT_CODE_IMPLEMENTATION.md**
- Copy-paste ready
- File-by-file changes
- No explanation (just code)
- All 6 files included

---

## Summary

| Aspect | Detail |
|--------|--------|
| **JWT Fields to Add** | 7 new fields (companyId, designation, firstName, lastName, isManager, isApprover, managerId) |
| **Modified Files** | 2 (auth.js, verify.middleware.js) |
| **New Files** | 3 (designation.middleware.js, auth.controller.js, auth.routes.js) |
| **Configuration Updates** | 1 (index.js) |
| **Total Implementation Time** | ~20 minutes |
| **Registration Flow** | Auto-creates company with selected country via API |
| **Multi-Tenant Support** | Full isolation via companyId |
| **Database** | Already schema-ready, no migration needed |
| **Testing** | 15-point verification checklist |

---

## Quick Start

1. **Read**: `JWT_QUICK_REFERENCE.md` (2 min)
2. **Implement**: `JWT_CODE_IMPLEMENTATION.md` (15 min)
3. **Test**: Run registration endpoint (2 min)
4. **Verify**: Decode JWT and confirm 10 fields (1 min)

**Total: 20 minutes to working registration!**

---

**Questions? Check the detailed documents:**
- What? → JWT_QUICK_REFERENCE.md
- Why? → JWT_BEFORE_AFTER.md  
- How? → JWT_CODE_IMPLEMENTATION.md
- Complete? → JWT_FIELDS_AND_ROUTES.md

All documents in `/temp` folder (non-git tracked).

