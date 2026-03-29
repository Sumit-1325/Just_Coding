# JWT & Registration Routes Report 📋

## Current JWT Setup Review

### ✅ Current JWT Fields in `auth.js`
```javascript
generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,  // ← Current
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}
```

### ❌ Missing Critical Fields for Multi-Tenant + Multi-Role System

---

## JWT Payload Fields to Add ⭐

Based on the new schema, JWT should include:

### **Essential Fields (MUST ADD)**

```javascript
{
  // Existing fields (KEEP)
  id: "employee_cuid",
  email: "user@company.com",
  role: "ADMIN|MANAGER|EMPLOYEE",  // Organizational role
  
  // NEW FIELDS (ADD)
  companyId: "company_cuid",        // ✅ CRITICAL - Multi-tenant
  designation: "FINANCE|DIRECTOR|CFO|HR|OPERATIONS",  // Job title
  firstName: "John",                // Display name
  lastName: "Doe",                  // Display name
}
```

### **Permission Fields (SHOULD ADD)**

```javascript
{
  // Above fields +
  isManager: true|false,            // Can manage employees
  isApprover: true|false,           // Can approve expenses
  managerId: "manager_cuid|null",   // Direct manager's ID
}
```

### **Complete JWT Payload (RECOMMENDED)**

```javascript
{
  // Identity
  id: "cuid_employee",
  email: "john@acme.com",
  
  // Company Context (CRITICAL for multi-tenant)
  companyId: "cuid_company",
  
  // Role & Authorization
  role: "ADMIN",                    // ADMIN, MANAGER, EMPLOYEE
  designation: "DIRECTOR",          // FINANCE, DIRECTOR, CFO, HR, OPERATIONS, CUSTOM
  
  // Permissions
  isManager: true,
  isApprover: true,
  
  // Organization Structure
  managerId: null|"cuid_manager",
  
  // Display & UI
  firstName: "John",
  lastName: "Doe",
  
  // Status (optional but useful)
  isActive: true,
  
  // Standard JWT claims
  iat: 1234567890,   // Issued at
  exp: 1234567890,   // Expires at
}
```

---

## Why These Fields? 🤔

| Field | Reason | Usage |
|-------|--------|-------|
| **companyId** | Multi-tenant isolation | Query: "Show expenses for this company only" |
| **designation** | Approval authority | Check: "Can this designation approve?" |
| **isManager** | Management permissions | UI: Show "Manage Employees" option |
| **isApprover** | Expense approvals | UI: Show "Pending Approvals" tab |
| **managerId** | Org structure | Query: "Show my reports" |
| **firstName/lastName** | Display name | UI: "Welcome, John Doe" |
| **role** | Basic access control | Gate: Admin-only endpoints |

---

## Implementation Steps

### Step 1: Update `auth.js` - generateToken()

**Before**:
```javascript
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}
```

**After**:
```javascript
export function generateToken(user) {
  return jwt.sign(
    {
      // Identity
      id: user.id,
      email: user.email,
      
      // Company Context (CRITICAL)
      companyId: user.companyId,
      
      // Role & Designation
      role: user.role,              // ADMIN, MANAGER, EMPLOYEE
      designation: user.designation, // FINANCE, DIRECTOR, CFO, etc.
      
      // Permissions
      isManager: user.isManager,
      isApprover: user.isApprover,
      
      // Organization
      managerId: user.managerId,
      
      // Display
      firstName: user.firstName,
      lastName: user.lastName,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}
```

---

### Step 2: Update `verify.middleware.js` - Add Company Context

**Before**:
```javascript
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
    req.user = decoded;      // ← Just decoded token
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
}
```

**After**:
```javascript
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
    req.user = decoded;
    req.companyId = decoded.companyId;  // ← Extract for easy access
    req.userId = decoded.id;            // ← Extract for easy access
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
}
```

---

### Step 3: Create Authorization Middleware for Designation

**New File**: `src/middleware/designation.middleware.js`

```javascript
/**
 * Designation-based Authorization Middleware
 * Checks if user has required designation for approval
 */

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
        message: `Access denied. Required designations: ${requiredDesignations.join(", ")}. Your designation: ${req.user.designation}`,
      });
    }

    next();
  };
}

/**
 * Check if user is an approver
 */
export function authorizeApprover(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  if (!req.user.isApprover) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to approve expenses",
    });
  }

  next();
}

/**
 * Check if user is a manager
 */
export function authorizeManager(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  if (!req.user.isManager) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to manage employees",
    });
  }

  next();
}

/**
 * Verify company access - ensure user is accessing their own company data
 */
export function verifyCompanyAccess(req, res, next) {
  if (!req.user || !req.companyId) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  // Extract companyId from params or query
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

## Route Structure Needed

### Directory Structure
```
Backend/src/
├── routes/
│   ├── auth.routes.js          ← Registration, Login, Refresh Token
│   ├── employee.routes.js      ← Employee CRUD (Admin/Manager)
│   ├── expense.routes.js       ← Expense submission & viewing
│   ├── approval.routes.js      ← Approval workflow
│   └── company.routes.js       ← Company settings
├── middleware/
│   ├── verify.middleware.js    ← Updated JWT verification
│   ├── authorization.middleware.js  ← Role-based (existing)
│   ├── designation.middleware.js    ← NEW: Designation-based
│   └── multer.middleware.js
├── utils/
│   └── auth.js                 ← Updated JWT generation
└── index.js
```

---

## Registration & Login Routes

### `src/routes/auth.routes.js`

```javascript
/**
 * Authentication Routes
 * - Signup/Register with auto-company creation
 * - Login
 * - Refresh Token
 * - Logout
 */

import express from "express";
import { 
  register, 
  login, 
  refreshToken, 
  logout 
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/verify.middleware.js";

const router = express.Router();

/**
 * POST /api/auth/register
 * Register new company + first admin user
 * 
 * Body:
 * {
 *   email: "admin@acme.com",
 *   password: "password",
 *   firstName: "John",
 *   lastName: "Doe",
 *   companyName: "Acme Corp",
 *   country: "India"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Registration successful",
 *   data: {
 *     employee: { id, email, firstName, lastName, role, designation, companyId },
 *     company: { id, name, country, currency, baseCurrency },
 *     accessToken: "jwt_token",
 *     refreshToken: "refresh_token_string"
 *   }
 * }
 */
router.post("/register", register);

/**
 * POST /api/auth/login
 * Login existing user
 * 
 * Body:
 * {
 *   email: "user@acme.com",
 *   password: "password"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Login successful",
 *   data: {
 *     employee: { id, email, firstName, lastName, role, designation, companyId },
 *     accessToken: "jwt_token",
 *     refreshToken: "refresh_token_string"
 *   }
 * }
 */
router.post("/login", login);

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 * 
 * Body:
 * {
 *   refreshToken: "refresh_token_string"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     accessToken: "new_jwt_token"
 *   }
 * }
 */
router.post("/refresh", refreshToken);

/**
 * POST /api/auth/logout
 * Logout and invalidate refresh token
 * Protected route
 */
router.post("/logout", authenticateToken, logout);

/**
 * GET /api/auth/me
 * Get current user profile
 * Protected route
 */
router.get("/me", authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

export default router;
```

---

## Registration Controller Logic Flow

### `src/controllers/auth.controller.js`

```javascript
/**
 * REGISTRATION FLOW:
 * 
 * 1. User visits app → selects country
 * 2. Calls POST /api/auth/register
 * 3. Validate email doesn't exist globally
 * 4. Fetch country currency from API
 * 5. Auto-create Company with country + currency
 * 6. Create first Employee (Admin) linked to Company
 * 7. Create default ApprovalRule
 * 8. Create default ExpenseCategories
 * 9. Generate JWT tokens
 * 10. Return both tokens + user info
 */

import prisma from "../lib/generated/prisma/index.js";
import { 
  generateToken, 
  generateRefreshTokenString,
  getRefreshTokenExpiry 
} from "../utils/auth.js";
import bcrypt from "bcrypt";

/**
 * Register - Create company and first admin user
 */
export async function register(req, res) {
  try {
    const { email, password, firstName, lastName, companyName, country } = req.body;

    // 1. Validate input
    if (!email || !password || !firstName || !companyName || !country) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, password, firstName, companyName, country"
      });
    }

    // 2. Check if email already exists (globally, since first login)
    const existingEmployee = await prisma.employee.findUnique({
      where: { email }
    });

    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    // 3. Fetch currency from API based on country
    const currencyResponse = await fetch(
      `https://restcountries.com/v3.1/all?fields=name,currencies`
    );
    const countries = await currencyResponse.json();
    const countryData = countries.find(c => c.name.common === country);
    
    if (!countryData || !countryData.currencies) {
      return res.status(400).json({
        success: false,
        message: "Invalid country selection"
      });
    }

    const currencyCode = Object.keys(countryData.currencies)[0];

    // 4. Create Company (AUTO-CREATION FLOW)
    const company = await prisma.company.create({
      data: {
        name: companyName,
        country: country,
        currency: currencyCode,
        baseCurrency: currencyCode,
        status: "ACTIVE"
      }
    });

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Create First Employee (Admin)
    const employee = await prisma.employee.create({
      data: {
        email: email,
        password: hashedPassword,
        firstName: firstName,
        lastName: lastName,
        companyId: company.id,
        role: "ADMIN",
        designation: "ADMIN",  // First admin has ADMIN designation
        isManager: true,
        isApprover: true,
        isActive: true,
        status: "ACTIVE"
      }
    });

    // 7. Create Company Settings
    await prisma.companySettings.create({
      data: {
        companyId: company.id,
        enableOCR: true
      }
    });

    // 8. Create Default Expense Categories
    await prisma.expenseCategory.createMany({
      data: [
        { companyId: company.id, name: "TRAVEL", isActive: true },
        { companyId: company.id, name: "MEALS", isActive: true },
        { companyId: company.id, name: "OFFICE_SUPPLIES", isActive: true },
        { companyId: company.id, name: "ACCOMMODATION", isActive: true },
        { companyId: company.id, name: "TRANSPORT", isActive: true }
      ]
    });

    // 9. Create Default Approval Rule
    const approvalRule = await prisma.approvalRule.create({
      data: {
        companyId: company.id,
        name: "Standard Multi-Level Approval",
        description: "Default approval workflow with Manager → Finance → Director",
        status: "ACTIVE"
      }
    });

    // 10. Create Approval Steps for default rule
    await prisma.approvalStep.createMany({
      data: [
        { 
          ruleId: approvalRule.id, 
          sequence: 1, 
          requiredDesignation: "MANAGER"
        },
        { 
          ruleId: approvalRule.id, 
          sequence: 2, 
          requiredDesignation: "FINANCE"
        },
        { 
          ruleId: approvalRule.id, 
          sequence: 3, 
          requiredDesignation: "DIRECTOR"
        }
      ]
    });

    // 11. Create Default Approval Condition (CFO auto-approve)
    await prisma.approvalCondition.create({
      data: {
        ruleId: approvalRule.id,
        conditionType: "SPECIFIC_DESIGNATION",
        specificDesignation: "CFO",
        action: "AUTO_APPROVE"
      }
    });

    // 12. Generate JWT tokens
    const accessToken = generateToken(employee);
    const refreshTokenString = generateRefreshTokenString();
    const refreshTokenExpiry = getRefreshTokenExpiry();

    // 13. Save refresh token to database
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        refreshToken: refreshTokenString,
        refreshTokenExpiry: refreshTokenExpiry
      }
    });

    // 14. Return response
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        employee: {
          id: employee.id,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: employee.role,
          designation: employee.designation,
          companyId: employee.companyId,
          isManager: employee.isManager,
          isApprover: employee.isApprover
        },
        company: {
          id: company.id,
          name: company.name,
          country: company.country,
          currency: company.currency,
          baseCurrency: company.baseCurrency
        },
        accessToken: accessToken,
        refreshToken: refreshTokenString
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
}

/**
 * Login - Authenticate existing user
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required"
      });
    }

    // 1. Find employee by email (now can be from any company)
    const employee = await prisma.employee.findFirst({
      where: { 
        email: email,
        isActive: true  // Only active employees can login
      },
      include: {
        company: true
      }
    });

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // 2. Compare password
    const passwordMatch = await bcrypt.compare(password, employee.password);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // 3. Generate tokens
    const accessToken = generateToken(employee);
    const refreshTokenString = generateRefreshTokenString();
    const refreshTokenExpiry = getRefreshTokenExpiry();

    // 4. Update refresh token
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        refreshToken: refreshTokenString,
        refreshTokenExpiry: refreshTokenExpiry
      }
    });

    // 5. Return response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        employee: {
          id: employee.id,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: employee.role,
          designation: employee.designation,
          companyId: employee.companyId,
          isManager: employee.isManager,
          isApprover: employee.isApprover
        },
        company: {
          id: employee.company.id,
          name: employee.company.name,
          country: employee.company.country,
          currency: employee.company.currency
        },
        accessToken: accessToken,
        refreshToken: refreshTokenString
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
}

/**
 * Refresh Token - Get new access token
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken: refreshTokenString } = req.body;

    if (!refreshTokenString) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required"
      });
    }

    // 1. Find employee with matching refresh token
    const employee = await prisma.employee.findFirst({
      where: { 
        refreshToken: refreshTokenString,
        refreshTokenExpiry: { gt: new Date() }  // Not expired
      }
    });

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    // 2. Generate new access token
    const accessToken = generateToken(employee);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: accessToken
      }
    });

  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({
      success: false,
      message: "Token refresh failed",
      error: error.message
    });
  }
}

/**
 * Logout - Invalidate refresh token
 */
export async function logout(req, res) {
  try {
    const employeeId = req.user.id;

    // Clear refresh token
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        refreshToken: null,
        refreshTokenExpiry: null
      }
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message
    });
  }
}
```

---

## JWT Payload Examples After Implementation

### Example 1: Admin User JWT
```json
{
  "id": "cuid_admin",
  "email": "admin@acme.com",
  "companyId": "cuid_company",
  "role": "ADMIN",
  "designation": "ADMIN",
  "firstName": "John",
  "lastName": "Doe",
  "isManager": true,
  "isApprover": true,
  "managerId": null,
  "iat": 1711766400,
  "exp": 1712371200
}
```

### Example 2: Manager with Director Designation
```json
{
  "id": "cuid_manager",
  "email": "sarah@acme.com",
  "companyId": "cuid_company",
  "role": "MANAGER",
  "designation": "DIRECTOR",
  "firstName": "Sarah",
  "lastName": "Smith",
  "isManager": true,
  "isApprover": true,
  "managerId": "cuid_admin",
  "iat": 1711766400,
  "exp": 1712371200
}
```

### Example 3: Regular Employee
```json
{
  "id": "cuid_employee",
  "email": "john@acme.com",
  "companyId": "cuid_company",
  "role": "EMPLOYEE",
  "designation": "OPERATIONS",
  "firstName": "John",
  "lastName": "Smith",
  "isManager": false,
  "isApprover": false,
  "managerId": "cuid_manager",
  "iat": 1711766400,
  "exp": 1712371200
}
```

---

## Using JWT Fields in Routes

### Example: Get All Employees in Company
```javascript
router.get("/employees", authenticateToken, authorizeRole("ADMIN", "MANAGER"), 
  verifyCompanyAccess, async (req, res) => {
    const employees = await prisma.employee.findMany({
      where: {
        companyId: req.user.companyId,  // ← Use companyId from JWT
        isActive: true
      }
    });
    res.json({ success: true, data: employees });
  }
);
```

### Example: Get Pending Approvals
```javascript
router.get("/approvals/pending", authenticateToken, authorizeApprover, async (req, res) => {
  const approvals = await prisma.approvalRequest.findMany({
    where: {
      approverId: req.user.id,          // ← Use id from JWT
      status: "PENDING"
    },
    include: {
      expense: {
        where: { companyId: req.user.companyId }  // ← Verify company access
      }
    }
  });
  res.json({ success: true, data: approvals });
});
```

### Example: Restrict by Designation
```javascript
router.post("/expenses/:id/approve", 
  authenticateToken, 
  authorizeDesignation("DIRECTOR", "CFO"), 
  async (req, res) => {
    // Only DIRECTOR or CFO can approve
    // ...
  }
);
```

---

## Summary Table

| Field | Current | New | Reason |
|-------|---------|-----|--------|
| `id` | ✅ | ✅ | Employee identifier |
| `email` | ✅ | ✅ | User identifier |
| `role` | ✅ | ✅ | Basic access control |
| `companyId` | ❌ | ✅ | **CRITICAL** - Multi-tenant |
| `designation` | ❌ | ✅ | Approval authority |
| `firstName` | ❌ | ✅ | Display name |
| `lastName` | ❌ | ✅ | Display name |
| `isManager` | ❌ | ✅ | Management capability |
| `isApprover` | ❌ | ✅ | Approval capability |
| `managerId` | ❌ | ✅ | Organization structure |

---

## Next Steps

1. ✅ Review JWT payload fields (THIS REPORT)
2. ⏳ Update `auth.js` with new fields
3. ⏳ Update `verify.middleware.js` with companyId extraction
4. ⏳ Create `designation.middleware.js` for approval routing
5. ⏳ Create controller with registration flow
6. ⏳ Create auth routes with all endpoints
7. ⏳ Test registration → auto-company creation
8. ⏳ Test login with JWT payload verification
9. ⏳ Test protected routes with companyId validation
10. ⏳ Test designation-based authorization

