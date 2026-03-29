# JWT Implementation - Side-by-Side Comparison 📊

## BEFORE vs AFTER

---

## 1. JWT Payload Comparison

### BEFORE (Current)
```javascript
// src/utils/auth.js - CURRENT
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,              // ✅ Has
      email: user.email,        // ✅ Has
      role: user.role,          // ✅ Has
      // ❌ Missing:
      // companyId
      // designation
      // firstName/lastName
      // isManager/isApprover
      // managerId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}
```

### AFTER (Updated)
```javascript
// src/utils/auth.js - UPDATED
export function generateToken(user) {
  return jwt.sign(
    {
      // Keep existing fields
      id: user.id,
      email: user.email,
      role: user.role,
      
      // ADD these 7 new fields
      companyId: user.companyId,           // ← NEW
      designation: user.designation,       // ← NEW
      firstName: user.firstName,           // ← NEW
      lastName: user.lastName,             // ← NEW
      isManager: user.isManager,           // ← NEW
      isApprover: user.isApprover,         // ← NEW
      managerId: user.managerId,           // ← NEW
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}
```

---

## 2. Middleware Comparison

### BEFORE (Current)
```javascript
// src/middleware/verify.middleware.js - CURRENT
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;  // ← Only has id, email, role
    // ❌ Can't access: companyId, designation, etc.
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
}
```

### AFTER (Updated)
```javascript
// src/middleware/verify.middleware.js - UPDATED
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;           // ← Now has all 10 fields
    req.companyId = decoded.companyId;  // ← NEW: Extract for easy access
    req.userId = decoded.id;            // ← NEW: Extract for easy access
    // ✅ Can now access: companyId, designation, isApprover, etc.
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
}
```

### NEW: Designation-Based Middleware
```javascript
// src/middleware/designation.middleware.js - NEW FILE
export function authorizeDesignation(...requiredDesignations) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!requiredDesignations.includes(req.user.designation)) {
      return res.status(403).json({
        success: false,
        message: `Required designations: ${requiredDesignations.join(", ")}`,
        your_designation: req.user.designation
      });
    }
    next();
  };
}

export function authorizeApprover(req, res, next) {
  if (!req.user?.isApprover) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to approve expenses",
    });
  }
  next();
}

export function authorizeManager(req, res, next) {
  if (!req.user?.isManager) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to manage employees",
    });
  }
  next();
}

export function verifyCompanyAccess(req, res, next) {
  const requestedCompanyId = req.params.companyId || req.query.companyId;
  
  if (requestedCompanyId && requestedCompanyId !== req.user.companyId) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this company",
    });
  }
  next();
}
```

---

## 3. Route Handler Comparison

### BEFORE: Authorization Middleware
```javascript
// src/middleware/authorization.middleware.js - EXISTING
export function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {  // ← Only role-based
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(", ")}`,
      });
    }

    next();
  };
}
```

### AFTER: Enhanced Authorization
```javascript
// Updated usage: Now can use BOTH role and designation

// Example 1: Role-based (keep existing)
router.get("/employees", 
  authenticateToken,
  authorizeRole("ADMIN", "MANAGER"),  // ← By role
  (req, res) => { ... }
);

// Example 2: Designation-based (NEW)
router.post("/expenses/:id/approve",
  authenticateToken,
  authorizeDesignation("DIRECTOR", "CFO"),  // ← By designation
  (req, res) => { ... }
);

// Example 3: Flag-based (NEW)
router.get("/approvals/pending",
  authenticateToken,
  authorizeApprover,  // ← By permission flag
  (req, res) => { ... }
);

// Example 4: Combined (NEW)
router.post("/expenses",
  authenticateToken,
  verifyCompanyAccess,       // ← Check company
  (req, res) => {
    // req.user.companyId used for filtering
    // All expenses filtered by req.user.companyId
  }
);
```

---

## 4. Database Query Comparison

### BEFORE: Limited Email Uniqueness
```javascript
// Email globally unique - problem for multi-tenant
@@index([email])  // Can't have same email in different companies

// Registration would fail if user has email in any company
const existingEmployee = await prisma.employee.findUnique({
  where: { email: "john@example.com" }  // ← Globally searches
});
```

### AFTER: Company-Scoped Email
```javascript
// Email unique per company - enables multi-tenant
@@unique([email, companyId])  // ← NEW

// Registration checks email only within company (if checking)
// Or allows same email in different companies
const existingEmployee = await prisma.employee.findFirst({
  where: { 
    email: "john@example.com",
    companyId: companyId  // ← Check per company if needed
  }
});
```

---

## 5. Registration Flow Comparison

### BEFORE: Would Need to Pass Company
```
User Registration:
  ❌ No company context in JWT
  ❌ Would need to select company first
  ❌ Can't auto-create company
```

### AFTER: Auto-Create Company
```
User Registration:
  1. Select Country
  2. POST /api/auth/register
  3. Auto-create Company with country
  4. Create Employee linked to company
  5. Return JWT with companyId
  6. Done!
  
// JWT now has companyId for all future requests
```

---

## 6. Request Handling Comparison

### BEFORE: Queries Not Filtered by Company
```javascript
// ❌ BEFORE: No company context, queries could leak data
router.get("/expenses", authenticateToken, (req, res) => {
  const expenses = await prisma.expense.findMany({});
    // ❌ Returns ALL expenses from ALL companies!!!
});
```

### AFTER: All Queries Filtered by Company
```javascript
// ✅ AFTER: Company context from JWT, secure filtering
router.get("/expenses", 
  authenticateToken,
  verifyCompanyAccess,  // ← Added
  (req, res) => {
    const expenses = await prisma.expense.findMany({
      where: {
        companyId: req.user.companyId  // ← Filter by user's company
        // Only returns expenses from that company
      }
    });
  }
);
```

---

## 7. Frontend Access Token Usage Comparison

### BEFORE
```javascript
// Frontend - BEFORE
const token = localStorage.getItem('accessToken');
// Can only get: id, email, role from token

// Would need separate API call to get company info
fetch('/api/user/profile')  // Extra call needed
  .then(res => res.json())
  .then(data => {
    // Now can access companyId, designation, etc.
  });
```

### AFTER
```javascript
// Frontend - AFTER
import { jwtDecode } from 'jwt-decode';

const token = localStorage.getItem('accessToken');
const user = jwtDecode(token);

// Can immediately access everything from token!
console.log(user.companyId);      // ✅ Available
console.log(user.designation);    // ✅ Available
console.log(user.isApprover);     // ✅ Available
console.log(user.isManager);      // ✅ Available
console.log(user.firstName);      // ✅ Available

// No extra API call needed!
// Can render UI immediately
if (user.isApprover) {
  showApprovalButton();
}

// Can set company context
const companyId = user.companyId;
```

---

## 8. Error Handling Comparison

### BEFORE: Vague Errors
```javascript
// ❌ Before: Generic error
return res.status(403).json({
  success: false,
  message: `Access denied. Required roles: DIRECTOR`
});

// User sees: "Access denied"
// User doesn't know their role
```

### AFTER: Informative Errors
```javascript
// ✅ After: Detailed error
export function authorizeDesignation(...requiredDesignations) {
  return (req, res, next) => {
    if (!requiredDesignations.includes(req.user.designation)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. 
          Required designations: ${requiredDesignations.join(", ")}`,
        your_role: req.user.role,
        your_designation: req.user.designation,
        your_companyId: req.user.companyId
      });
    }
    next();
  };
}

// User sees: Clear message + their actual designation
// "You are MANAGER with FINANCE designation, not DIRECTOR"
```

---

## 9. Security Improvements

### BEFORE (Vulnerable)
```
❌ No company isolation - all data visible
❌ No designation-based auth - only role-based
❌ Email could conflict - only 1 email globally
❌ No approval structure in JWT - need DB queries
```

### AFTER (Secure)
```
✅ Company isolation - queries filtered by companyId
✅ Designation-based auth - approval level control
✅ Multi-tenant emails - same email in different companies
✅ Complete context in JWT - fast authorization checks
```

---

## 10. Performance Impact

### BEFORE: Extra DB Queries Needed
```
Request received
  → Verify token ✅
  → Query DB to get user details ❌ Extra query
  → Query DB to get company info ❌ Extra query
  → Query DB to check permissions ❌ Extra query
  → Finally process request

Total: 3+ extra database queries per request
```

### AFTER: Everything in JWT
```
Request received
  → Verify token ✅
  → Check token payload (in-memory)
  → Check companyId (in-memory)
  → Check designation (in-memory)
  → Check isApprover (in-memory)
  → Finally process request

Total: 0 extra database queries for auth
```

---

## Implementation Checklist

### Step 1: Update JWT Generation
- [ ] Open `src/utils/auth.js`
- [ ] Add 7 new fields to `generateToken()` payload
- [ ] Test: Decode token and verify fields exist

### Step 2: Update JWT Verification
- [ ] Open `src/middleware/verify.middleware.js`
- [ ] Extract companyId to req.companyId
- [ ] Test: Check req.companyId in route handler

### Step 3: Create Designation Middleware
- [ ] Create `src/middleware/designation.middleware.js`
- [ ] Add 4 middleware functions
- [ ] Test: Try unauthorized designation access

### Step 4: Create Auth Controller
- [ ] Create `src/controllers/auth.controller.js`
- [ ] Implement register() with company auto-creation
- [ ] Implement login() 
- [ ] Implement refreshToken()
- [ ] Implement logout()
- [ ] Test: Full registration flow

### Step 5: Create Auth Routes
- [ ] Create `src/routes/auth.routes.js`
- [ ] Add 5 endpoints
- [ ] Test: All endpoints working

### Step 6: Integration
- [ ] Update `src/index.js` to mount routes
- [ ] Test: End-to-end flow
- [ ] Verify company filtering works

---

## Testing Validation

### Test 1: JWT Contains All Fields
```javascript
POST /api/auth/register
→ Check accessToken contains:
  ✅ id
  ✅ email
  ✅ role
  ✅ companyId  (NEW)
  ✅ designation (NEW)
  ✅ firstName (NEW)
  ✅ lastName (NEW)
  ✅ isManager (NEW)
  ✅ isApprover (NEW)
  ✅ managerId (NEW)
```

### Test 2: Company Auto-Creation
```javascript
POST /api/auth/register
{
  country: "India",
  companyName: "Acme Corp"
}
→ Check Company created:
  ✅ name: "Acme Corp"
  ✅ country: "India"
  ✅ currency: "INR"
  ✅ baseCurrency: "INR"
```

### Test 3: Multi-Tenant Isolation
```javascript
// Admin A from Company 1
// Admin B from Company 2
// Both can register with same email

User A: john@test.com + Company 1
User B: john@test.com + Company 2
→ Both should work (email unique per company)
```

### Test 4: Designation-Based Authorization
```javascript
// Employee with designation="FINANCE" tries to approve
POST /api/expenses/123/approve
Header: Authorization: Bearer [token with designation=FINANCE]
Route: authorizeDesignation("DIRECTOR", "CFO")
→ Should be rejected (403)
```

---

## Summary of Changes

```
Modified Files:
├── src/utils/auth.js                    (generateToken - ADD 7 fields)
├── src/middleware/verify.middleware.js  (authenticateToken - Extract companyId)
└── src/middleware/authorization.middleware.js (Keep as-is, now can combine with new one)

New Files:
├── src/middleware/designation.middleware.js (4 new middleware functions)
├── src/controllers/auth.controller.js       (Register, login, refresh, logout)
├── src/routes/auth.routes.js                (5 endpoints)
└── (possibly) src/routes/employee.routes.js (For future: manage employees)

Updated Files:
└── src/index.js (Import and mount auth routes)

Database:
└── Already updated schema.prisma (no migration needed for this)
```

