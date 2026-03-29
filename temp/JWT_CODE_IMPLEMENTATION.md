# JWT Implementation - Code Changes (Copy-Paste Ready) 📝

## File 1: Update `src/utils/auth.js`

### Current Code (Lines 18-27)
```javascript
/**
 * Generate JWT token for user
 * @param {Object} user - User object with id, email, role
 * @returns {string} JWT token
 */
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

### Replace With This
```javascript
/**
 * Generate JWT token for user
 * @param {Object} user - User object with complete info
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      // Identity
      id: user.id,
      email: user.email,
      
      // Company Context (CRITICAL for multi-tenant)
      companyId: user.companyId,
      
      // Role & Designation
      role: user.role,                    // ADMIN, MANAGER, EMPLOYEE
      designation: user.designation,     // FINANCE, DIRECTOR, CFO, etc.
      
      // Permissions
      isManager: user.isManager || false,
      isApprover: user.isApprover || false,
      
      // Organization Structure
      managerId: user.managerId || null,
      
      // Display Information
      firstName: user.firstName,
      lastName: user.lastName || "",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}
```

---

## File 2: Update `src/middleware/verify.middleware.js`

### Current Code (All of it)
```javascript
/**
 * JWT Verification Middleware
 * Verifies JWT token and attaches user to request
 */

import { verifyToken } from "../utils/auth.js";

/**
 * Middleware to verify JWT and attach user to request
 * Extracts Bearer token from Authorization header
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }
}
```

### Replace With This
```javascript
/**
 * JWT Verification Middleware
 * Verifies JWT token and attaches user to request
 */

import { verifyToken } from "../utils/auth.js";

/**
 * Middleware to verify JWT and attach user to request
 * Extracts Bearer token from Authorization header
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;                    // Contains all JWT fields
    req.companyId = decoded.companyId;     // Extract for easy access
    req.userId = decoded.id;               // Extract for easy access
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

## File 3: Create NEW `src/middleware/designation.middleware.js`

```javascript
/**
 * Designation-Based Authorization Middleware
 * Provides fine-grained access control based on job titles
 */

/**
 * Authorize based on designation
 * @param {...string} requiredDesignations - Allowed designations
 * @returns {Function} Middleware function
 * 
 * Usage: authorizeDesignation("DIRECTOR", "CFO", "FINANCE")
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
        message: `Access denied. Required designations: ${requiredDesignations.join(", ")}`,
        your_designation: req.user.designation,
        your_role: req.user.role,
      });
    }

    next();
  };
}

/**
 * Check if user is an approver
 * Usage: router.get(..., authenticateToken, authorizeApprover, handler)
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
      your_role: req.user.role,
      your_isApprover: req.user.isApprover,
    });
  }

  next();
}

/**
 * Check if user is a manager
 * Usage: router.get(..., authenticateToken, authorizeManager, handler)
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
      your_role: req.user.role,
      your_isManager: req.user.isManager,
    });
  }

  next();
}

/**
 * Verify user has access to requested company
 * Usage: router.get(..., authenticateToken, verifyCompanyAccess, handler)
 * 
 * Checks req.params.companyId or req.query.companyId against user's company
 */
export function verifyCompanyAccess(req, res, next) {
  if (!req.user || !req.user.companyId) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  // Extract companyId from URL params or query params
  const requestedCompanyId = req.params.companyId || req.query.companyId;
  
  // If company is specified in request, verify match
  if (requestedCompanyId && requestedCompanyId !== req.user.companyId) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this company",
      requested_company: requestedCompanyId,
      your_company: req.user.companyId,
    });
  }

  next();
}

/**
 * Verify user is accessing their own data
 * Usage: router.get("/profile/:userId", ..., verifyOwnAccess, handler)
 */
export function verifyOwnAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  const requestedUserId = req.params.userId;
  
  if (requestedUserId && requestedUserId !== req.user.id) {
    // Allow if user is ADMIN or MANAGER
    if (!["ADMIN", "MANAGER"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You can only access your own data",
        requested_user: requestedUserId,
        your_id: req.user.id,
      });
    }
  }

  next();
}
```

---

## File 4: Create NEW `src/controllers/auth.controller.js`

```javascript
/**
 * Authentication Controller
 * Handles registration, login, token refresh, and logout
 */

import prisma from "../lib/generated/prisma/index.js";
import bcrypt from "bcrypt";
import { 
  generateToken, 
  generateRefreshTokenString,
  getRefreshTokenExpiry 
} from "../utils/auth.js";

/**
 * REGISTRATION FLOW:
 * 1. Validate input
 * 2. Check email doesn't exist (globally for first signup)
 * 3. Fetch country currency
 * 4. Auto-create Company
 * 5. Create Admin Employee
 * 6. Create default resources (settings, categories, rules)
 * 7. Generate tokens
 * 8. Return response
 */
export async function register(req, res) {
  try {
    const { email, password, firstName, lastName, companyName, country } = req.body;

    // 1. Validate required fields
    if (!email || !password || !firstName || !companyName || !country) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        required: ["email", "password", "firstName", "companyName", "country"]
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    // 2. Check if email already exists (globally)
    const existingEmployee = await prisma.employee.findFirst({
      where: { email: email }
    });

    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    // 3. Fetch country currency from API
    let currencyCode = "USD"; // Default fallback
    try {
      const countriesResponse = await fetch(
        "https://restcountries.com/v3.1/all?fields=name,currencies"
      );
      const countries = await countriesResponse.json();
      const countryData = countries.find(c => c.name.common === country);
      
      if (countryData && countryData.currencies) {
        currencyCode = Object.keys(countryData.currencies)[0];
      }
    } catch (error) {
      console.warn("Failed to fetch currency, using USD:", error.message);
      // Continue with default currency
    }

    // 4. Create Company (AUTO-CREATION)
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

    // 6. Create Admin Employee
    const employee = await prisma.employee.create({
      data: {
        email: email,
        password: hashedPassword,
        firstName: firstName,
        lastName: lastName || "",
        companyId: company.id,
        role: "ADMIN",
        designation: "ADMIN",
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
        description: "Default workflow: Manager → Finance → Director",
        status: "ACTIVE"
      }
    });

    // 10. Create Approval Steps
    await prisma.approvalStep.createMany({
      data: [
        { ruleId: approvalRule.id, sequence: 1, requiredDesignation: "MANAGER" },
        { ruleId: approvalRule.id, sequence: 2, requiredDesignation: "FINANCE" },
        { ruleId: approvalRule.id, sequence: 3, requiredDesignation: "DIRECTOR" }
      ]
    });

    // 11. Create Approval Condition (CFO auto-approve)
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
      message: "Registration successful. Welcome!",
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
 * LOGIN FLOW:
 * 1. Validate input
 * 2. Find employee by email
 * 3. Compare password
 * 4. Generate tokens
 * 5. Update refresh token
 * 6. Return response
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

    // 1. Find employee by email (active only)
    const employee = await prisma.employee.findFirst({
      where: { 
        email: email,
        isActive: true
      },
      include: { company: true }
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

    // 4. Update refresh token in database
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
 * REFRESH TOKEN FLOW:
 * 1. Validate refresh token
 * 2. Find employee with valid refresh token
 * 3. Generate new access token
 * 4. Return response
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

    // 1. Find employee with matching non-expired refresh token
    const employee = await prisma.employee.findFirst({
      where: { 
        refreshToken: refreshTokenString,
        refreshTokenExpiry: { gt: new Date() }
      }
    });

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    // 2. Generate new access token
    const newAccessToken = generateToken(employee);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(500).json({
      success: false,
      message: "Token refresh failed",
      error: error.message
    });
  }
}

/**
 * LOGOUT FLOW:
 * 1. Clear refresh token from database
 * 2. Return response
 */
export async function logout(req, res) {
  try {
    const employeeId = req.user.id;

    // Clear refresh token from database
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

## File 5: Create NEW `src/routes/auth.routes.js`

```javascript
/**
 * Authentication Routes
 * POST   /api/auth/register    - Register new company + admin
 * POST   /api/auth/login       - Login user
 * POST   /api/auth/refresh     - Refresh access token
 * POST   /api/auth/logout      - Logout (clear tokens)
 * GET    /api/auth/me          - Get current user profile
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
 * Register new company and first admin user
 * 
 * @body {string} email - Admin email
 * @body {string} password - Admin password (min 8 chars)
 * @body {string} firstName - Admin first name
 * @body {string} lastName - Admin last name (optional)
 * @body {string} companyName - Company name
 * @body {string} country - Country name
 * 
 * @response {string} accessToken - JWT access token
 * @response {string} refreshToken - Refresh token string
 * @response {Object} employee - Employee data
 * @response {Object} company - Company data
 */
router.post("/register", register);

/**
 * POST /api/auth/login
 * Login with email and password
 * 
 * @body {string} email - User email
 * @body {string} password - User password
 * 
 * @response {string} accessToken - JWT access token
 * @response {string} refreshToken - Refresh token string
 * @response {Object} employee - Employee data
 * @response {Object} company - Company data
 */
router.post("/login", login);

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 * 
 * @body {string} refreshToken - Refresh token string
 * 
 * @response {string} accessToken - New JWT access token
 */
router.post("/refresh", refreshToken);

/**
 * POST /api/auth/logout
 * Logout and invalidate refresh token
 * Protected route - requires valid JWT
 * 
 * @header {string} Authorization - Bearer token
 * @response {string} message - Logout successful
 */
router.post("/logout", authenticateToken, logout);

/**
 * GET /api/auth/me
 * Get current user profile from JWT
 * Protected route - requires valid JWT
 * 
 * @header {string} Authorization - Bearer token
 * @response {Object} user - Current user from JWT payload
 */
router.get("/me", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "User profile retrieved",
    data: req.user
  });
});

export default router;
```

---

## File 6: Update `src/index.js`

### Find This Section
```javascript
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/user.js";
```

### Change To
```javascript
import authRoutes from "./routes/auth.routes.js";        // ← Updated path
// import adminRoutes from "./routes/admin.js";           // ← Comment out for now
// import userRoutes from "./routes/user.js";             // ← Comment out for now
```

### Find This Section (Mount routes)
```javascript
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
```

### Keep As Is Or Update
```javascript
app.use("/api/auth", authRoutes);        // ← This should work
// app.use("/api/admin", adminRoutes);   // ← Comment if file doesn't exist
// app.use("/api/users", userRoutes);    // ← Comment if file doesn't exist
```

---

## Testing Endpoints

### 1. Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Acme Corporation",
    "country": "India"
  }'
```

### 2. Login  
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123"
  }'
```

### 3. Get Profile
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer {accessToken}"
```

### 4. Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "{refreshToken}"
  }'
```

### 5. Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer {accessToken}"
```

---

## What Gets Created Upon Registration

### Company Table
```
✅ Created automatically from selected country
- name: "Acme Corporation"
- country: "India"
- currency: "INR" (fetched from API)
- baseCurrency: "INR"
- status: "ACTIVE"
```

### Employee Table
```
✅ Created as first admin
- email: "admin@acme.com"
- role: "ADMIN"
- designation: "ADMIN"
- companyId: <new company ID>
- isManager: true
- isApprover: true
```

### CompanySettings Table
```
✅ Created with defaults
- companyId: <new company ID>
- enableOCR: true
```

### ExpenseCategory Table
```
✅ Created 5 default categories
- TRAVEL
- MEALS
- OFFICE_SUPPLIES
- ACCOMMODATION
- TRANSPORT
```

### ApprovalRule Table
```
✅ Created "Standard Multi-Level Approval"
- Step 1: MANAGER
- Step 2: FINANCE
- Step 3: DIRECTOR
- Condition: CFO auto-approves
```

---

## JWT Token Decoded Example

```javascript
// accessToken when decoded (using jwtDecode library)
{
  "id": "clh5p8q2z0001m3g9k0x0x0x0",
  "email": "admin@acme.com",
  "companyId": "clh5p8q2z0002m3g9k0y0y0y0",
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

---

## Verification Checklist

- [ ] `src/utils/auth.js` - Added 7 fields to generateToken()
- [ ] `src/middleware/verify.middleware.js` - Extract companyId
- [ ] `src/middleware/designation.middleware.js` - Created with 5 functions
- [ ] `src/controllers/auth.controller.js` - Created with 4 controllers
- [ ] `src/routes/auth.routes.js` - Created with 5 endpoints
- [ ] `src/index.js` - Updated import and mount auth routes
- [ ] Database has Prisma client generated
- [ ] Dependencies installed: bcrypt (npm install bcrypt)
- [ ] .env has JWT_SECRET set
- [ ] Test register endpoint
- [ ] Test login endpoint  
- [ ] Test GET /me endpoint
- [ ] Verify JWT contains all 10 fields
- [ ] Verify company auto-created
- [ ] Verify default categories created
- [ ] Verify approval rule created

---

**All files are copy-paste ready!** 
Just follow the sequence and run tests to verify.

