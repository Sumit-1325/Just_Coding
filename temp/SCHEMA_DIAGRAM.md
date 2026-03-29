# Database Schema Diagram - Registration Flow

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         REGISTRATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

                              COMPANY
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
              EMPLOYEE      EXPENSE        APPROVAL_RULE
                │ │           │ │            │    │
         (Manager) │           │ │            │    │
            (Self) │           │ │      APPROVAL  APPROVAL
                  │            │ │         STEP  CONDITION
            APPROVAL_REQUEST  │ │
                  │            │ │
                  └────────────┼─┘
                    APPROVAL_HISTORY


              COMPANY_SETTINGS
                  (1-to-1)
                   │
                COMPANY
```

---

## Table Structure

### COMPANY
```
┌─ id (PK)
├─ name (String)
├─ country (String)          ← Selected during registration
├─ currency (String)         ← From country
├─ baseCurrency (String)     ← Default for calculations
├─ status (CompanyStatus)
├─ createdAt
└─ updatedAt

Relationships:
├─ employees (1:N)
├─ expenses (1:N)
├─ approvalRules (1:N)
├─ categories (1:N)
└─ settings (1:1)
```

### EMPLOYEE (Per Company)
```
┌─ id (PK)
├─ email (String, unique per companyId)
├─ password (String)
├─ firstName (String)
├─ lastName (String)
├─ companyId (FK) ▶ COMPANY          ← Links to company
├─ department (String)
├─ avatar (String)
├─ bio (String)
├─ role (EmployeeRole)               ← ADMIN, MANAGER, EMPLOYEE
├─ designation (String)              ← FINANCE, DIRECTOR, CFO, etc.
├─ managerId (FK) ▶ EMPLOYEE (self)  ← Manager relationship
├─ isManager (Boolean)
├─ isApprover (Boolean)
├─ approvalSequence (Int)
├─ isActive (Boolean)
├─ status (EmployeeStatus)
├─ refreshToken (String)
├─ refreshTokenExpiry (DateTime)
├─ createdAt
└─ updatedAt

Relationships:
├─ company (N:1)
├─ manager (1:1, optional)
├─ subordinates (1:N, self)
├─ submittedExpenses (1:N)
├─ approvalRequests (1:N)
└─ approvalHistories (1:N)

Unique Constraints:
└─ (email, companyId)

Indexes:
├─ companyId
├─ email
├─ role
├─ designation
├─ managerId
└─ status
```

### EXPENSE
```
┌─ id (PK)
├─ companyId (FK) ▶ COMPANY
├─ employeeId (FK) ▶ EMPLOYEE        ← Who submitted
├─ amount (Decimal)                  ← Original amount
├─ currencyCode (String)             ← Original currency
├─ amountInBaseCurrency (Decimal)    ← Converted
├─ category (ExpenseCategoryType)    ← TRAVEL, MEALS, etc.
├─ description (String)
├─ date (DateTime)
├─ receiptUrl (String)
├─ ocrData (Json)
├─ status (ExpenseStatus)            ← PENDING, APPROVED, REJECTED
├─ submittedAt
├─ createdAt
└─ updatedAt

Relationships:
├─ company (N:1)
├─ employee (N:1)
├─ approvalRequests (1:N)
└─ approvalHistories (1:N)

Indexes:
├─ companyId
├─ employeeId
├─ status
├─ submittedAt
└─ date
```

### EXPENSE_CATEGORY
```
┌─ id (PK)
├─ companyId (FK) ▶ COMPANY
├─ name (String)        ← "Travel", "Meals", etc.
├─ description (String)
├─ isActive (Boolean)
└─ createdAt

Unique Constraints:
└─ (companyId, name)

Indexes:
├─ companyId
└─ isActive
```

### APPROVAL_RULE
```
┌─ id (PK)
├─ companyId (FK) ▶ COMPANY
├─ name (String)            ← "Standard Multi-Level"
├─ description (String)
├─ status (CompanyStatus)   ← ACTIVE, INACTIVE
├─ createdAt
└─ updatedAt

Relationships:
├─ steps (1:N)
└─ conditions (1:N)

Unique Constraints:
└─ (companyId, name)

Indexes:
├─ companyId
└─ status
```

### APPROVAL_STEP
```
┌─ id (PK)
├─ ruleId (FK) ▶ APPROVAL_RULE
├─ sequence (Int)            ← Step order: 1, 2, 3...
├─ requiredDesignation (String)  ← "MANAGER", "FINANCE", "DIRECTOR"
└─ createdAt

Unique Constraints:
└─ (ruleId, sequence)

Indexes:
├─ ruleId
└─ requiredDesignation
```

### APPROVAL_REQUEST
```
┌─ id (PK)
├─ expenseId (FK) ▶ EXPENSE
├─ approverId (FK) ▶ EMPLOYEE       ← Who approves
├─ sequence (Int)                   ← Which step
├─ status (ApprovalRequestStatus)   ← PENDING, APPROVED, REJECTED
├─ requiredDesignation (String)     ← Must match approver's designation
├─ comment (String)
├─ createdAt
├─ updatedAt
└─ completedAt (DateTime)

Unique Constraints:
└─ (expenseId, sequence)

Indexes:
├─ expenseId
├─ approverId
├─ status
├─ sequence
└─ requiredDesignation
```

### APPROVAL_CONDITION
```
┌─ id (PK)
├─ ruleId (FK) ▶ APPROVAL_RULE
├─ conditionType (ApprovalConditionType)
│   ├─ PERCENTAGE_RULE
│   ├─ SPECIFIC_DESIGNATION
│   └─ HYBRID
├─ percentage (Int)              ← e.g., 60
├─ specificDesignation (String)  ← e.g., "CFO"
├─ action (ApprovalAction)
│   ├─ AUTO_APPROVE
│   └─ SKIP_TO_FINAL
└─ createdAt

Indexes:
├─ ruleId
└─ specificDesignation
```

### APPROVAL_HISTORY
```
┌─ id (PK)
├─ expenseId (FK) ▶ EXPENSE
├─ approverId (FK) ▶ EMPLOYEE
├─ approverDesignation (String)     ← Snapshot of designation
├─ action (ApprovalHistoryAction)   ← APPROVED, REJECTED
├─ comment (String)
└─ actionAt (DateTime)

Indexes:
├─ expenseId
├─ approverId
├─ actionAt
└─ approverDesignation
```

### COMPANY_SETTINGS
```
┌─ id (PK)
├─ companyId (FK) ▶ COMPANY         ← 1-to-1 relationship
├─ defaultApprovalRuleId (String)
├─ enableOCR (Boolean)
├─ requireReceiptAboveAmount (Decimal)
├─ maxExpenseAmount (Decimal)
├─ createdAt
└─ updatedAt

Indexes:
└─ companyId
```

---

## Registration API Flow Data Creation

```sql
CREATE Company:
  INSERT INTO "Company" (id, name, country, currency, baseCurrency, status)
  VALUES (uuid, name, 'India', 'INR', 'INR', 'ACTIVE')
  
CREATE Admin Employee:
  INSERT INTO "Employee" 
    (id, email, password, firstName, companyId, role, designation, 
     isManager, isApprover, status, isActive)
  VALUES 
    (uuid, 'admin@email.com', hash(pwd), 'John', companyId, 
     'ADMIN', 'ADMIN', true, true, 'ACTIVE', true)

Unique Constraint Check:
  SELECT * FROM "Employee" 
  WHERE email = $1 AND companyId = $2
  // Should be empty (first user)

Foreign Key Relationships:
  ├─ Employee.companyId REFERENCES Company.id
  └─ Employee.managerId REFERENCES Employee.id (NULL for admin)
```

---

## Query Patterns for Registration Flow

### 1. Get company by ID
```sql
SELECT * FROM "Company" WHERE id = $1;
```

### 2. Check if email exists in company
```sql
SELECT * FROM "Employee" 
WHERE email = $1 AND companyId = $2;
```

### 3. Get admin user of company
```sql
SELECT * FROM "Employee" 
WHERE companyId = $1 AND role = 'ADMIN' LIMIT 1;
```

### 4. Get all employees in company
```sql
SELECT * FROM "Employee" 
WHERE companyId = $1 AND isActive = true
ORDER BY createdAt DESC;
```

### 5. Get employee with manager info
```sql
SELECT e.*, m.firstName as managerFirstName, m.lastName as managerLastName
FROM "Employee" e
LEFT JOIN "Employee" m ON e.managerId = m.id
WHERE e.id = $1;
```

---

## Cascade Delete Behavior

```
COMPANY deleted
  ▼
├─ All EMPLOYEE records deleted
│  ├─ All EXPENSE records deleted
│  │  ├─ All APPROVAL_REQUEST records deleted
│  │  └─ All APPROVAL_HISTORY records deleted
│  ├─ All APPROVAL_REQUEST records deleted
│  └─ All APPROVAL_HISTORY records deleted
├─ All APPROVAL_RULE records deleted
│  ├─ All APPROVAL_STEP records deleted
│  └─ All APPROVAL_CONDITION records deleted
├─ All EXPENSE_CATEGORY records deleted
└─ COMPANY_SETTINGS record deleted
```

---

## Constraints Summary

| Constraint | Table | Rule |
|-----------|-------|------|
| **Primary Key** | All | `id` (CUID) |
| **Unique** | Employee | `(email, companyId)` |
| **Unique** | ApprovalRule | `(companyId, name)` |
| **Unique** | ApprovalStep | `(ruleId, sequence)` |
| **Unique** | ApprovalRequest | `(expenseId, sequence)` |
| **Unique** | ExpenseCategory | `(companyId, name)` |
| **Unique** | CompanySettings | `companyId` (1-to-1) |
| **Foreign Key** | Employee → Company | `companyId` |
| **Foreign Key** | Employee → Employee | `managerId` (self) |
| **Foreign Key** | Expense → Company | `companyId` |
| **Foreign Key** | Expense → Employee | `employeeId` |
| **Foreign Key** | ApprovalRule → Company | `companyId` |
| **Foreign Key** | ApprovalStep → ApprovalRule | `ruleId` |
| **Foreign Key** | ApprovalRequest → Expense | `expenseId` |
| **Foreign Key** | ApprovalRequest → Employee | `approverId` |
| **Foreign Key** | ApprovalCondition → ApprovalRule | `ruleId` |
| **Foreign Key** | ApprovalHistory → Expense | `expenseId` |
| **Foreign Key** | ApprovalHistory → Employee | `approverId` |
| **Foreign Key** | CompanySettings → Company | `companyId` |

