# JWT Fields Summary - Quick Reference ⚡

## What to Add to JWT Token

### Current JWT (Only 3 fields)
```
{
  id,
  email,
  role
}
```

### ➕ ADD THESE 7 FIELDS
```
✅ companyId         ← CRITICAL for multi-tenant
✅ designation       ← Job title for approval routing
✅ firstName         ← Display in UI
✅ lastName          ← Display in UI
✅ isManager         ← Can manage employees?
✅ isApprover        ← Can approve expenses?
✅ managerId         ← Who is their manager?
```

### Updated JWT (10 fields total)
```json
{
  "id": "cuid_employee",
  "email": "john@company.com",
  "companyId": "cuid_company",           // ← NEW
  "role": "ADMIN/MANAGER/EMPLOYEE",
  "designation": "DIRECTOR/FINANCE/CFO", // ← NEW
  "firstName": "John",                   // ← NEW
  "lastName": "Doe",                     // ← NEW
  "isManager": true,                     // ← NEW
  "isApprover": true,                    // ← NEW
  "managerId": null,                     // ← NEW
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Why Each Field?

```
companyId      → Query only company's data (multi-tenant isolation)
designation    → Check who can approve expenses
firstName      → Welcome message: "Hi John!"
lastName       → Full name display
isManager      → Show "Manage Employees" button
isApprover     → Show "Pending Approvals" tab
managerId      → Show team members
```

---

## Which Files to Modify? 📝

```
src/utils/auth.js
  └─ generateToken() function
     └─ Add these 7 fields to jwt.sign()

src/middleware/verify.middleware.js
  └─ authenticateToken() function
     └─ Extract companyId to req.companyId

src/middleware/designation.middleware.js [NEW FILE]
  └─ authorizeDesignation() - Check designation
  └─ authorizeApprover() - Check isApprover flag
  └─ authorizeManager() - Check isManager flag
  └─ verifyCompanyAccess() - Check companyId matches
```

---

## Registration Flow Routes

### Before (What happens now with new schema):
```
POST /api/auth/register
  Input: email, password, firstName, companyName, country
  Process:
    1. Create Company with selected country + currency
    2. Create first Employee (Admin) linked to Company
    3. Create default ExpenseCategories
    4. Create default ApprovalRule
  Output: accessToken + refreshToken + user data
```

### After (What will be built):
```
POST /api/auth/register   → ✅ Auto-create company + admin
POST /api/auth/login      → ✅ Login any user
POST /api/auth/refresh    → ✅ Get new access token
POST /api/auth/logout     → ✅ Invalidate tokens
GET  /api/auth/me         → ✅ Get current user profile
```

---

## Access Token Usage in Frontend

### Before
```javascript
// Old JWT (only 3 fields)
const token = localStorage.getItem('accessToken');
// Can only know: id, email, role
```

### After
```javascript
// New JWT (10 fields)
const token = localStorage.getItem('accessToken');
const decoded = jwtDecode(token);

// Now you can access:
console.log(decoded.companyId);    // Filter data by company
console.log(decoded.designation);   // Show "Director" badge
console.log(decoded.firstName);     // Welcome message
console.log(decoded.isApprover);    // Show/hide approval buttons
console.log(decoded.isManager);     // Show/hide admin menu

// UI Example:
if (decoded.isManager) {
  showManageEmployeesButton();
}

if (decoded.isApprover) {
  showPendingApprovalsTab();
}

// Query Example:
fetch(`/api/expenses?companyId=${decoded.companyId}`)
```

---

## Middleware Order in Routes

```javascript
// Example: Employee approval endpoint

router.post("/expenses/:id/approve", 
  authenticateToken,            // ← 1. Check JWT valid
  authorizeApprover,            // ← 2. Check isApprover = true
  authorizeDesignation("DIRECTOR", "CFO"),  // ← 3. Check designation
  verifyCompanyAccess,          // ← 4. Check company access
  approveExpenseHandler         // ← 5. Handle business logic
);
```

---

## Quick Checklist

### To Implement JWT Changes:

- [ ] Read JWT_FIELDS_AND_ROUTES.md (full details)
- [ ] Update `generateToken()` in auth.js with 7 new fields
- [ ] Update `authenticateToken()` in verify.middleware.js
- [ ] Create `designation.middleware.js` with 4 functions
- [ ] Create `auth.controller.js` with registration logic
- [ ] Create `auth.routes.js` with 5 endpoints
- [ ] Update `index.js` to import auth routes
- [ ] Test registration flow (company auto-creation)
- [ ] Test login with email check per company
- [ ] Test JWT payload contains all fields

---

## Database Query Patterns

### User Registration (Create company + admin):
```javascript
// 1. Fetch currency from API
const countries = await fetch('https://restcountries.com/v3.1/all...')

// 2. Create Company
const company = await prisma.company.create({
  data: { name, country, currency, baseCurrency, status }
})

// 3. Hash password
const hashedPassword = await bcrypt.hash(password, 10)

// 4. Create Employee
const employee = await prisma.employee.create({
  data: { 
    email, 
    password: hashedPassword, 
    firstName, 
    companyId: company.id,
    role: "ADMIN",
    designation: "ADMIN",
    isManager: true,
    isApprover: true
  }
})
```

### User Login (Find by email):
```javascript
// Note: Email is now unique per company, not globally
// So you find first by email, then check company

const employee = await prisma.employee.findFirst({
  where: { email }  // Can exist in multiple companies
})
```

---

## Testing Payloads

### Register Admin
```
POST /api/auth/register
{
  "email": "admin@acme.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Acme Corp",
  "country": "India"
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eeaa1234...",
  "employee": {
    "id": "cuid123",
    "email": "admin@acme.com",
    "firstName": "John",
    "role": "ADMIN",
    "designation": "ADMIN",
    "companyId": "cuid456",
    "isManager": true,
    "isApprover": true
  },
  "company": {
    "id": "cuid456",
    "name": "Acme Corp",
    "country": "India",
    "currency": "INR",
    "baseCurrency": "INR"
  }
}
```

### Login User
```
POST /api/auth/login
{
  "email": "admin@acme.com",
  "password": "SecurePass123"
}

Response: Same as register
```

### Get New Access Token
```
POST /api/auth/refresh
{
  "refreshToken": "eeaa1234..."
}

Response:
{
  "accessToken": "eyJhbGc..."
}
```

---

## Common Use Cases Enabled by JWT Fields

| Use Case | Enabled By |
|----------|-----------|
| Multi-tenant isolation | `companyId` |
| Show user name in UI | `firstName`, `lastName` |
| Route approvals by designation | `designation` |
| Show approval buttons | `isApprover` |
| Show management menu | `isManager` |
| Show team members | `managerId` |
| Verify company access | `companyId` |
| Auto-filter by company | `companyId` |

---

## Next Implementation: File-by-File

#### 1. Update `src/utils/auth.js`
Add 7 fields to `generateToken()` function payload

#### 2. Update `src/middleware/verify.middleware.js`
Extract `companyId` from decoded token

#### 3. Create `src/middleware/designation.middleware.js` [NEW]
Add 4 middleware functions for designation-based auth

#### 4. Create `src/controllers/auth.controller.js` [NEW]
Implement registration flow with company auto-creation

#### 5. Create `src/routes/auth.routes.js` [NEW]
Define 5 endpoints: register, login, refresh, logout, me

#### 6. Update `src/index.js`
Import and mount auth routes

---

## Summary

### Current JWT Issues:
- Missing `companyId` → Can't implement multi-tenant isolation
- Missing `designation` → Can't route approvals correctly
- Missing permission flags → Can't show/hide UI elements
- Missing manager info → Can't show organizational structure

### After Implementation:
- ✅ Multi-tenant safe - all queries filtered by companyId
- ✅ Approval routing - can check designation
- ✅ UI Control - can conditionally show features
- ✅ Company auto-creation - register creates company
- ✅ Email per company - same email in different companies
- ✅ Full JWT context - everything needed in token

