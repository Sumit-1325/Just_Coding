# Registration Flow Schema - Implementation Complete ✅

## Schema Updated Successfully

The Prisma schema has been updated with all models required for the registration flow.

---

## Registration Flow Architecture

### On First Login/Signup (Auto-Creation Flow):

```sql
User visits app
  ↓
Selects Country
  ↓
Auto-create Company (country + currency)
  ↓
Create First Employee (Admin)
  ↓
Employee linked to Company
  ↓
Admin Now Can Manage System
```

---

## Complete Models Created

### 1. **Company** ✅
```prisma
model Company {
  id              String        @id @default(cuid())
  name            String
  country         String        // Selected during signup
  currency        String        // Country's currency
  baseCurrency    String        // Default for expense calculations
  status          CompanyStatus @default(ACTIVE)
  
  // Relationships to all company resources
  employees       Employee[]
  expenses        Expense[]
  approvalRules   ApprovalRule[]
  categories      ExpenseCategory[]
  settings        CompanySettings?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}
```

**Registration Flow Role**: 
- Auto-created when first admin signs up
- Stores company-level settings and currency information
- One company can have many employees

---

### 2. **Employee** (UPDATED) ✅
```prisma
model Employee {
  id                  String          @id @default(cuid())
  email               String
  password            String
  firstName           String
  lastName            String?
  
  // Company relationship (NEW)
  companyId           String
  company             Company         @relation(...)
  
  // Profile & Department
  department          String?
  avatar              String?
  bio                 String?
  
  // Role & Designation (SEPARATED)
  role                EmployeeRole    @default(EMPLOYEE)      // ADMIN, MANAGER, EMPLOYEE
  designation         String          @default("EMPLOYEE")    // FINANCE, DIRECTOR, CFO, etc.
  
  // Manager relationship (NEW)
  managerId           String?
  manager             Employee?       @relation("ManagerRelation", ...)
  subordinates        Employee[]      @relation("ManagerRelation")
  
  // Approval permissions (NEW)
  isManager           Boolean         @default(false)
  isApprover          Boolean         @default(false)
  approvalSequence    Int?
  
  // Status
  isActive            Boolean         @default(true)
  status              EmployeeStatus  @default(ACTIVE)
  
  // Authentication
  refreshToken        String?
  refreshTokenExpiry  DateTime?
  
  // Relationships
  submittedExpenses   Expense[]       @relation("SubmittedBy")
  approvalRequests    ApprovalRequest[] @relation("ApproverFor")
  approvalHistories   ApprovalHistory[] @relation("ApprovedBy")
  
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@unique([email, companyId])  // Email unique PER COMPANY, not globally
  @@index([companyId])
  @@index([role])
  @@index([designation])
  @@index([managerId])
}
```

**Registration Flow Changes**:
- ~~`email` is globally unique~~ → `email` unique per company
- ✅ Added `companyId` FK
- ✅ Added `designation` field (job title)
- ✅ Separated `role` enum (ADMIN, MANAGER, EMPLOYEE)
- ✅ Added manager relationship (`managerId`)
- ✅ Added approval flags

**First Admin Creation Flow**:
```
1. User signs up
2. Fetch selected country's currency from API
3. Create Company with:
   - name = from signup
   - country = from selection
   - currency = from API
   - baseCurrency = currency
4. Create Employee with:
   - email = signup email
   - companyId = new Company ID
   - role = ADMIN
   - designation = "ADMIN" (or user's chosen title)
   - password = hashed password
   - isManager = true
   - isApprover = true
```

---

### 3. **Expense** ✅ (NEW)
```prisma
model Expense {
  id                    String        @id @default(cuid())
  companyId             String        // Which company this belongs to
  company               Company       @relation(...)
  
  employeeId            String        // Who submitted
  employee              Employee      @relation("SubmittedBy", ...)
  
  // Expense Data
  amount                Decimal       // Original amount
  currencyCode          String        // Original currency
  amountInBaseCurrency  Decimal       // Converted to company's base currency
  category              ExpenseCategoryType  // TRAVEL, MEALS, etc.
  description           String
  date                  DateTime      // When expense occurred
  
  // Receipt & OCR
  receiptUrl            String?       // Receipt image path
  ocrData               Json?         // Extracted OCR data
  
  // Status
  status                ExpenseStatus @default(PENDING)  // PENDING, APPROVED, REJECTED
  
  // Relationships
  approvalRequests      ApprovalRequest[]
  approvalHistories     ApprovalHistory[]
  
  submittedAt           DateTime      @default(now())
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([companyId])
  @@index([employeeId])
  @@index([status])
  @@index([submittedAt])
}
```

---

### 4. **ExpenseCategory** ✅ (NEW)
```prisma
model ExpenseCategory {
  id          String    @id @default(cuid())
  companyId   String    // Per-company categories
  company     Company   @relation(...)
  
  name        String    // "Travel", "Meals", etc.
  description String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  @@unique([companyId, name])
  @@index([companyId])
}
```

---

### 5. **ApprovalRule** ✅ (NEW)
```prisma
model ApprovalRule {
  id              String  @id @default(cuid())
  companyId       String  // Per-company
  company         Company @relation(...)
  
  name            String  // "Standard Multi-Level Approval"
  description     String?
  status          CompanyStatus @default(ACTIVE)
  
  // Relationships
  steps           ApprovalStep[]      // Sequence of approvals
  conditions      ApprovalCondition[] // Conditional logic
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([companyId, name])
}
```

**Example**:
```
Rule: "Standard Approval"
  - Step 1: requiredDesignation = "MANAGER" (sequence: 1)
  - Step 2: requiredDesignation = "FINANCE" (sequence: 2)
  - Step 3: requiredDesignation = "DIRECTOR" (sequence: 3)
  
  - Condition 1: If 60% of approvers approve → AUTO_APPROVE
  - Condition 2: If CFO approves → AUTO_APPROVE
```

---

### 6. **ApprovalStep** ✅ (NEW)
```prisma
model ApprovalStep {
  id                    String  @id @default(cuid())
  ruleId                String
  rule                  ApprovalRule @relation(...)
  
  sequence              Int     // Order: 1, 2, 3...
  requiredDesignation   String  // "MANAGER", "FINANCE", "DIRECTOR", "CFO"
  
  createdAt             DateTime @default(now())

  @@unique([ruleId, sequence])
}
```

---

### 7. **ApprovalRequest** ✅ (NEW)
```prisma
model ApprovalRequest {
  id                    String  @id @default(cuid())
  
  // Links
  expenseId             String
  expense               Expense @relation(...)
  
  approverId            String  // Employee to approve
  approver              Employee @relation("ApproverFor", ...)
  
  // Details
  sequence              Int     // Step in approval chain
  status                ApprovalRequestStatus @default(PENDING)
  requiredDesignation   String  // Must match approver's designation
  comment               String? // Approval/rejection reason
  
  // Timestamps
  createdAt             DateTime @default(now())
  completedAt           DateTime? // When approved/rejected

  @@unique([expenseId, sequence])
}
```

---

### 8. **ApprovalCondition** ✅ (NEW)
```prisma
model ApprovalCondition {
  id                    String  @id @default(cuid())
  ruleId                String
  rule                  ApprovalRule @relation(...)
  
  conditionType         ApprovalConditionType  // PERCENTAGE_RULE, SPECIFIC_DESIGNATION, HYBRID
  percentage            Int?    // e.g., 60 for 60%
  specificDesignation   String? // e.g., "CFO"
  action                ApprovalAction // AUTO_APPROVE, SKIP_TO_FINAL
  
  createdAt             DateTime @default(now())
}
```

**Examples**:
- "If 60% of approvers approve → AUTO_APPROVE"
- "If CFO designation approves → AUTO_APPROVE"
- "If 60% OR CFO approves → AUTO_APPROVE"

---

### 9. **ApprovalHistory** ✅ (NEW)
```prisma
model ApprovalHistory {
  id                    String @id @default(cuid())
  
  expenseId             String
  expense               Expense @relation(...)
  
  approverId            String
  approver              Employee @relation("ApprovedBy", ...)
  
  // Snapshot of approver's designation at time of approval
  approverDesignation   String
  
  action                ApprovalHistoryAction   // APPROVED, REJECTED
  comment               String?
  
  actionAt              DateTime @default(now())

  @@index([expenseId])
  @@index([approverId])
  @@index([actionAt])
}
```

---

### 10. **CompanySettings** ✅ (NEW)
```prisma
model CompanySettings {
  id                        String  @id @default(cuid())
  companyId                 String  @unique
  company                   Company @relation(...)
  
  defaultApprovalRuleId     String?
  enableOCR                 Boolean @default(true)
  requireReceiptAboveAmount Decimal?
  maxExpenseAmount          Decimal?
  
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}
```

---

## Complete Enum Definitions

```prisma
enum EmployeeRole {
  ADMIN
  MANAGER
  EMPLOYEE
}

enum Designation {
  FINANCE
  DIRECTOR
  CFO
  HR
  OPERATIONS
  MANAGER
  CUSTOM
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum CompanyStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum ExpenseCategoryType {
  TRAVEL
  MEALS
  OFFICE_SUPPLIES
  ACCOMMODATION
  TRANSPORT
  OTHER
}

enum ExpenseStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ApprovalRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ApprovalConditionType {
  PERCENTAGE_RULE
  SPECIFIC_DESIGNATION
  HYBRID
}

enum ApprovalAction {
  AUTO_APPROVE
  SKIP_TO_FINAL
}

enum ApprovalHistoryAction {
  APPROVED
  REJECTED
}
```

---

## Indexes for Performance

**All created indexes**:
- Company: `status`
- Employee: `companyId`, `email`, `role`, `designation`, `managerId`, `status`
- Expense: `companyId`, `employeeId`, `status`, `submittedAt`, `date`
- ExpenseCategory: `companyId`, `isActive`
- ApprovalRule: `companyId`, `status`
- ApprovalStep: `ruleId`, `requiredDesignation`
- ApprovalRequest: `expenseId`, `approverId`, `status`, `sequence`, `requiredDesignation`
- ApprovalCondition: `ruleId`, `specificDesignation`
- ApprovalHistory: `expenseId`, `approverId`, `actionAt`, `approverDesignation`

---

## Registration Flow Complete Data Creation Example

```javascript
// 1. User Signup API receives:
{
  email: "admin@acme.com",
  password: "hashed_password",
  firstName: "John",
  lastName: "Doe",
  country: "India"  // Selected from country dropdown
}

// 2. Auto-created records:
// A) Company created:
{
  id: "cuid_company_id",
  name: "Acme Corp India",
  country: "India",
  currency: "INR",
  baseCurrency: "INR",
  status: "ACTIVE"
}

// B) Admin Employee created:
{
  id: "cuid_employee_id",
  email: "admin@acme.com",
  companyId: "cuid_company_id",
  firstName: "John",
  lastName: "Doe",
  role: "ADMIN",
  designation: "ADMIN",
  isManager: true,
  isApprover: true,
  status: "ACTIVE",
  isActive: true
}

// C) CompanySettings created:
{
  id: "cuid_settings_id",
  companyId: "cuid_company_id",
  enableOCR: true
}

// D) Default Expense Categories created:
[
  { name: "TRAVEL", companyId: "..." },
  { name: "MEALS", companyId: "..." },
  { name: "OFFICE_SUPPLIES", companyId: "..." },
  { name: "ACCOMMODATION", companyId: "..." },
  { name: "TRANSPORT", companyId: "..." }
]

// E) Default ApprovalRule created:
{
  id: "cuid_rule_id",
  companyId: "cuid_company_id",
  name: "Standard Multi-Level Approval",
  status: "ACTIVE"
}

// With ApprovalSteps:
[
  { ruleId: "...", sequence: 1, requiredDesignation: "MANAGER" },
  { ruleId: "...", sequence: 2, requiredDesignation: "FINANCE" },
  { ruleId: "...", sequence: 3, requiredDesignation: "DIRECTOR" }
]
```

---

## Key Registration Flow Components

### Database Uniqueness Constraints
- ✅ Email unique per company (not globally)
- ✅ Company name required
- ✅ One ApprovalRule name per company
- ✅ One ApprovalStep sequence per rule
- ✅ One ApprovalRequest per expense per sequence

### Relationships Cascade Behavior
- ✅ Company deleted → All Employees, Expenses, Rules deleted
- ✅ Employee deleted → All submitted expenses deleted
- ✅ ApprovalRule deleted → All steps and conditions deleted
- ✅ Expense deleted → All approval requests deleted

### Foreign Key Constraints
- ✅ Employee.companyId → Company.id
- ✅ Employee.managerId → Employee.id (optional, self-ref)
- ✅ Expense.companyId → Company.id
- ✅ Expense.employeeId → Employee.id
- ✅ ApprovalRequest.expenseId → Expense.id
- ✅ ApprovalRequest.approverId → Employee.id

---

## Next Steps

1. ✅ Schema created and validated
2. ⏳ Create registration API endpoint
3. ⏳ Create login API endpoint
4. ⏳ Create employee management endpoints
5. ⏳ Create approval workflow logic
6. ⏳ Create expense submission endpoints

---

## Schema File Details

**Location**: `d:\sumit\code\main_hackathon\Backend\prisma\schema.prisma`
**Status**: ✅ Generated Successfully
**Prisma Client**: Generated to `./src/lib/generated/prisma`
**Total Models**: 10
**Total Enums**: 8
**Total Tables**: 10

