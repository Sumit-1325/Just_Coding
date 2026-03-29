# Reimbursement Management System - Prisma Schema Plan

## Overview
This document outlines the complete Prisma schema requirements for the Reimbursement Management System based on the problem statement.

---

## Current State
- Basic `Employee` model exists with user authentication fields
- Schema provider: PostgreSQL
- Prisma client output: `../src/lib/generated/prisma`

---

## Role vs Designation Clarification ⭐

**IMPORTANT**: Roles and Designations are SEPARATE concepts:

### Role (Organizational Hierarchy)
- **ADMIN** - Company administrator with full permissions
- **MANAGER** - Can approve expenses, manage team
- **EMPLOYEE** - Regular employee submitting expenses

### Designation (Job Title/Department Position)
- **FINANCE** - Finance department
- **DIRECTOR** - Director level
- **CFO** - Chief Financial Officer
- **HR** - Human Resources
- **OPERATIONS** - Operations team
- Custom designations per company

**Example**:
```
User A:
  - role = MANAGER (organizationally they are a manager)
  - designation = DIRECTOR (their actual job title)
  - Can approve expenses as a Director-level approver

User B:
  - role = MANAGER (organizationally they are a manager)
  - designation = FINANCE (their actual job title)
  - Can approve expenses as a Finance-level approver

User C:
  - role = EMPLOYEE (regular employee)
  - designation = FINANCE (works in finance but has no approval power)
```

---

## Phase 1: Core Entity Models
These are the foundational models needed for the system.

### 1. **Company Model** ✅ NEEDED
**Purpose**: Represents each company using the platform
- `id` (String, PK)
- `name` (String)
- `country` (String) - Selected during first admin signup
- `currency` (String) - Set based on country selection (from restcountries API)
- `baseCurrency` (String) - Default currency for the company
- `status` (String) - ACTIVE, INACTIVE (enum recommended)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relationships**:
- One Company → Many Employees
- One Company → Many ApprovalRules
- One Company → Many Expenses

---

### 2. **Employee Model** ⚠️ NEEDS MODIFICATION
**Current Fields**: Basic auth + profile
**New Fields Needed**:
- `companyId` (String, FK) - Link to Company
- `role` (String enum) - **ADMIN, MANAGER, EMPLOYEE** (organizational role ONLY)
- `designation` (String) - **FINANCE, DIRECTOR, CFO, HR, OPERATIONS, etc.** (job title/position)
- `managerId` (String, FK) - Self-referential for manager relationship
- `isManager` (Boolean) - Whether employee can be a manager for approvals
- `isApprover` (Boolean) - Whether employee can approve expenses based on their designation
- `approvalSequence` (Int?) - Order in approval flow (if multi-step)
- `department` (String) - Department name
- `isActive` (Boolean) - Active status in company

**Relationships**:
- Many Employees → One Company
- Employee → Manager (Many Employees → One Employee as Manager)
- One Employee → Many Expenses (submitted)
- One Employee → Many ApprovalRequests (to approve)
- One Employee → Many ApprovalHistories (approvals done)

**Schema Example**:
```prisma
model Employee {
  id                  String      @id @default(cuid())
  email               String
  password            String
  firstName           String
  lastName            String?
  
  companyId           String
  company             Company     @relation(fields: [companyId], references: [id])
  
  role                EmployeeRole @default(EMPLOYEE)        // ADMIN, MANAGER, EMPLOYEE
  designation         String                                  // FINANCE, DIRECTOR, CFO, HR, etc.
  
  managerId           String?
  manager             Employee?   @relation("ManagerRelation", fields: [managerId], references: [id])
  subordinates        Employee[]  @relation("ManagerRelation")
  
  isManager           Boolean     @default(false)
  isApprover          Boolean     @default(false)
  approvalSequence    Int?
  
  department          String?
  isActive            Boolean     @default(true)
  
  @@unique([email, companyId])
  @@index([companyId])
  @@index([role])
  @@index([designation])
  @@index([managerId])
}
```

**Note**: Role enum should have: ADMIN, MANAGER, EMPLOYEE

---

### 3. **Expense Model** ✅ NEEDED
**Purpose**: Core expense record submitted by employees
- `id` (String, PK)
- `companyId` (String, FK)
- `employeeId` (String, FK) - Who submitted
- `amount` (Decimal) - Original amount in employee's currency
- `currencyCode` (String) - Currency of submitted amount
- `amountInBaseCurrency` (Decimal) - Converted to company's base currency
- `category` (String) - Travel, Meals, Office, etc. (enum)
- `description` (String)
- `date` (DateTime) - When expense occurred
- `receiptUrl` (String?) - Path to receipt image
- `ocrData` (Json?) - Extracted data from OCR
- `status` (String) - PENDING, APPROVED, REJECTED (enum)
- `submittedAt` (DateTime)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relationships**:
- Many Expenses → One Company
- Many Expenses → One Employee (submitter)
- One Expense → Many ApprovalRequests (approval chain)
- One Expense → Many ApprovalHistories (audit trail)

---

### 4. **ApprovalRequest Model** ✅ NEEDED
**Purpose**: Individual approval steps in the workflow
- `id` (String, PK)
- `expenseId` (String, FK)
- `approverId` (String, FK) - Employee to approve
- `sequence` (Int) - Order in approval flow (1, 2, 3...)
- `status` (String) - PENDING, APPROVED, REJECTED (enum)
- `requiredDesignation` (String) - MANAGER, FINANCE, DIRECTOR, CFO (required designation to approve)
- `comment` (String?) - Approval/Rejection reason
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- `completedAt` (DateTime?) - When approved/rejected

**Relationships**:
- Many ApprovalRequests → One Expense
- Many ApprovalRequests → One Employee (approverId)

**Logic**:
- Only ONE approval request is PENDING at a time
- Next request becomes PENDING only after current is completed
- Approver must have matching or higher designation

---

### 5. **ApprovalRule Model** ✅ NEEDED
**Purpose**: Define approval workflow rules per company
- `id` (String, PK)
- `companyId` (String, FK)
- `name` (String) - e.g., "Standard Multi-Level Approval"
- `description` (String?)
- `status` (String) - ACTIVE, INACTIVE
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relationships**:
- Many ApprovalRules → One Company
- One ApprovalRule → Many ApprovalSteps
- One ApprovalRule → Many ApprovalConditions

---

### 6. **ApprovalStep Model** ✅ NEEDED
**Purpose**: Individual steps within an approval rule based on DESIGNATION
- `id` (String, PK)
- `ruleId` (String, FK)
- `sequence` (Int) - Order of approval (1, 2, 3...)
- `requiredDesignation` (String) - **MANAGER, FINANCE, DIRECTOR, CFO, HR, etc.**
- `createdAt` (DateTime)

**Relationships**:
- Many ApprovalSteps → One ApprovalRule

**Example Data**:
```
Rule: "Standard Approval"
  - Step 1: MANAGER (sequence 1) - First approval by direct manager
  - Step 2: FINANCE (sequence 2) - Finance team checks
  - Step 3: DIRECTOR (sequence 3) - Director final approval
```

---

### 7. **ApprovalCondition Model** ✅ NEEDED
**Purpose**: Conditional logic for approvals (percentage, specific approver designation)
- `id` (String, PK)
- `ruleId` (String, FK)
- `conditionType` (String) - PERCENTAGE_RULE, SPECIFIC_DESIGNATION, HYBRID (enum)
- `percentage` (Int?) - e.g., 60 for 60% of approvers
- `specificDesignation` (String?) - For CFO auto-approval (e.g., "CFO")
- `action` (String) - AUTO_APPROVE, SKIP_TO_FINAL (enum)
- `createdAt` (DateTime)

**Relationships**:
- Many ApprovalConditions → One ApprovalRule

**Examples**:
- "If 60% of approvers approve → AUTO_APPROVE"
- "If any approver has CFO designation → AUTO_APPROVE"
- "If 60% OR CFO designation approves → AUTO_APPROVE" (Hybrid)

---

### 8. **ApprovalHistory Model** ✅ NEEDED
**Purpose**: Audit trail of all approvals/rejections
- `id` (String, PK)
- `expenseId` (String, FK)
- `approverId` (String, FK)
- `approverDesignation` (String) - Designation of approver at time of approval (snapshot)
- `action` (String) - APPROVED, REJECTED (enum)
- `comment` (String?)
- `actionAt` (DateTime) @default(now())

**Relationships**:
- Many ApprovalHistories → One Expense
- Many ApprovalHistories → One Employee (approverId)

---

### 9. **ExpenseCategory Model** ✅ NEEDED (Optional but recommended)
**Purpose**: Standardize expense categories
- `id` (String, PK)
- `companyId` (String, FK)
- `name` (String) - Travel, Meals, Office, etc.
- `description` (String?)
- `isActive` (Boolean)
- `createdAt` (DateTime)

**Relationships**:
- Many ExpenseCategories → One Company

---

### 10. **CompanySettings Model** ✅ NICE TO HAVE
**Purpose**: Store company-specific configurations
- `id` (String, PK)
- `companyId` (String, FK)
- `defaultApprovalRuleId` (String, FK)
- `enableOCR` (Boolean)
- `requireReceiptAboveAmount` (Decimal?)
- `maxExpenseAmount` (Decimal?)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Relationships**:
- One CompanySettings → One Company
- CompanySettings → One ApprovalRule (defaultRule)

---

## Phase 2: Relations & Dependencies Map

### Relationship Hierarchy:
```
Company
├── Employee (many) [role: ADMIN/MANAGER/EMPLOYEE, designation: FINANCE/DIRECTOR/CFO/etc]
│   ├── Expenses (submitted)
│   ├── ApprovalRequests (to approve - based on designation)
│   ├── ApprovalHistories (approvals done)
│   └── Manager relationship (self-ref, managerId)
├── ApprovalRules (many)
│   ├── ApprovalSteps (many, each requires specific DESIGNATION)
│   └── ApprovalConditions (many, check DESIGNATION)
├── Expenses (many)
│   ├── ApprovalRequests (approval chain - based on designation flow)
│   └── ApprovalHistories (audit trail)
└── CompanySettings

Employee (self-relationship):
├── managerId → Employee (manager)
└── subordinates → Employee[] (managed employees)
```

---

## Phase 3: Key Indexes & Constraints

### Indexes Needed (Performance):
```prisma
// Employee
@@index([companyId])
@@index([managerId])
@@index([role])
@@index([designation])
@@unique([email, companyId])  // Email unique per company, not globally

// Expense
@@index([companyId])
@@index([employeeId])
@@index([status])
@@index([submittedAt])
@@index([date])

// ApprovalRequest
@@index([expenseId])
@@index([approverId])
@@index([status])
@@index([sequence])
@@index([requiredDesignation])

// ApprovalRule
@@index([companyId])
@@index([status])

// ApprovalStep
@@index([ruleId])
@@index([requiredDesignation])

// ApprovalCondition
@@index([ruleId])
@@index([specificDesignation])

// ApprovalHistory
@@index([expenseId])
@@index([approverId])
@@index([actionAt])
@@index([approverDesignation])
```
@@index([sequence])

// ApprovalRule
@@index([companyId])
@@index([status])

// ApprovalHistory
@@index([expenseId])
@@index([approverId])
@@index([actionAt])
```

---

## Phase 4: Enum Definitions

### Required Enums:
```prisma
enum EmployeeRole {
  ADMIN
  MANAGER
  EMPLOYEE
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum Designation {
  FINANCE
  DIRECTOR
  CFO
  HR
  OPERATIONS
  MANAGER
  CUSTOM  // For extensibility
}

enum ExpenseStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ExpenseCategory {
  TRAVEL
  MEALS
  OFFICE_SUPPLIES
  ACCOMMODATION
  TRANSPORT
  OTHER
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

enum CompanyStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
```

---

## Phase 5: Implementation Steps (Schema Only)

### Step 1: Create Company Model
- Add `Company` model with country, currency, baseCurrency fields

### Step 2: Modify Employee Model
- Add `companyId` FK relationship
- Add `managerId` self-referential FK
- Modify `role` field to enum (ADMIN, MANAGER, EMPLOYEE) - ORGANIZATIONAL ROLE ONLY
- **ADD `designation` field (String) - JOB TITLE/POSITION (FINANCE, DIRECTOR, CFO, etc.)**
- Add `isManager`, `isApprover` fields
- Update email to be unique per company (composite unique)

### Step 3: Create Expense Model
- Foundation for expense tracking
- Include currency conversion fields
- Link to Employee & Company

### Step 4: Create Approval Models
- `ApprovalRequest` - individual approval steps
- `ApprovalRule` - workflow definitions
- `ApprovalStep` - steps within rules
- `ApprovalCondition` - conditional approval logic
- `ApprovalHistory` - audit trail

### Step 5: Create Supporting Models
- `ExpenseCategory` - category management
- `CompanySettings` - company configurations

### Step 6: Add Indexes & Constraints
- Performance indexes on frequently queried fields
- Unique constraints for email per company
- Foreign key constraints

---

## Data Flow & Relationships

### On First Signup (Admin User):
```
1. Create new Company (auto-create)
   - country = selected country
   - baseCurrency = country's currency
2. Create first Employee (Admin)
   - companyId = new Company ID
   - role = ADMIN
   - designation = "FINANCE" (or whatever their title is)
   - email = signup email
3. Admin can now manage other employees and their designations
```

### On Expense Submission (Employee):
```
1. Create Expense record
   - companyId, employeeId, amount, category, etc.
   - Calculate amountInBaseCurrency using exchangerate API
   - status = PENDING
2. Fetch ApprovalRule for company
3. Create ApprovalRequest records (one per step based on required DESIGNATION)
   - ApprovalStep 1: requiredDesignation = "MANAGER"
   - ApprovalStep 2: requiredDesignation = "FINANCE"
   - ApprovalStep 3: requiredDesignation = "DIRECTOR"
4. First PENDING ApprovalRequest created (Step 1: MANAGER)
   - Find employee with role=MANAGER or matching manager
   - Generate notification for manager to approve
```

### On Approval Action (Manager):
```
1. Find current PENDING ApprovalRequest
   - Check if approver's DESIGNATION matches requiredDesignation
   - If YES: can approve/reject
   - If NO: cannot approve (error)
2. Update current ApprovalRequest
   - status = APPROVED/REJECTED
   - comment = approval comment
3. Create ApprovalHistory record
   - approverDesignation = approver's current designation (snapshot)
   - action = APPROVED/REJECTED
4. Check ApprovalConditions
   - If 60% rule met → Mark Expense as APPROVED
   - If CFO designation found → AUTO_APPROVE
5. If not approved, move to next ApprovalRequest
   - Mark as PENDING
   - Generate notification for next approver (based on required DESIGNATION)
```

---

## SQL Considerations

### Key Queries to Optimize For:
1. Get pending approvals for a manager with specific designation:
   ```sql
   SELECT * FROM "ApprovalRequest" 
   WHERE approverId = $1 
   AND status = 'PENDING'
   AND requiredDesignation = (
     SELECT designation FROM "Employee" WHERE id = $1
   )
   ORDER BY createdAt
   ```

2. Get company expenses with approval status:
   ```sql
   SELECT e.*, COUNT(ar.id) as approval_count
   FROM "Expense" e
   LEFT JOIN "ApprovalRequest" ar ON e.id = ar.expenseId
   WHERE e.companyId = $1
   GROUP BY e.id
   ```

3. Get approval history with designations:
   ```sql
   SELECT ah.*, e.firstName, e.lastName, e.designation
   FROM "ApprovalHistory" ah
   JOIN "Employee" e ON ah.approverId = e.id
   WHERE ah.expenseId = $1
   ORDER BY ah.actionAt DESC
   ```

---

## Summary: 10 Models Required

| # | Model | Purpose | Status |
|---|-------|---------|--------|
| 1 | Company | Company entity tracking | ✅ NEW |
| 2 | Employee | Modified + role/designation separation | ⚠️ MODIFY |
| 3 | Expense | Expense submissions | ✅ NEW |
| 4 | ApprovalRequest | Individual approval steps (by designation) | ✅ NEW |
| 5 | ApprovalRule | Workflow templates | ✅ NEW |
| 6 | ApprovalStep | Steps in rules (require specific designation) | ✅ NEW |
| 7 | ApprovalCondition | Conditional logic (based on designation) | ✅ NEW |
| 8 | ApprovalHistory | Audit trail with designation snapshots | ✅ NEW |
| 9 | ExpenseCategory | Category standardization | ✅ NEW |
| 10 | CompanySettings | Company configurations | ✅ NEW |

---

## Key Difference: Role vs Designation ⭐

| Aspect | Role | Designation |
|--------|------|------------|
| **Definition** | Organizational position | Job title/department position |
| **Values** | ADMIN, MANAGER, EMPLOYEE | FINANCE, DIRECTOR, CFO, HR, etc. |
| **Determines** | Basic permissions in system | Approval authority level |
| **Fixed** | Can change per company policy | Can change when promoted |
| **Multi-level approval** | Uses designation, not role | MANAGER (role) with DIRECTOR (designation) can approve |
| **Example** | John is a MANAGER | John's designation is DIRECTOR |

---

## Example Approval Flow Visualization

```
Company: Acme Corp
ApprovalRule: "Standard Approval"
  Step 1: requiredDesignation = "MANAGER"
  Step 2: requiredDesignation = "FINANCE"
  Step 3: requiredDesignation = "DIRECTOR"

Employee John (role=EMPLOYEE, designation=OPERATIONS) submits $1000 expense

Approval Chain:
┌─────────────────────────────────────────────────────┐
│ Step 1: PENDING → needs MANAGER to approve          │
│ Assigned to: Sarah (role=MANAGER, designation=HR)   │
│ Sarah approves ✓                                    │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: PENDING → needs FINANCE to approve          │
│ Assigned to: Mike (role=MANAGER, designation=FINANCE)
│ Mike approves ✓                                     │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: PENDING → needs DIRECTOR to approve         │
│ Assigned to: Lisa (role=MANAGER, designation=DIRECTOR)
│ Lisa approves ✓                                     │
└─────────────────────────────────────────────────────┘
         ↓
         EXPENSE APPROVED ✓
```

---

## Next Steps
- [ ] Review and approve schema plan with role/designation split
- [ ] Implement models in order (Phase 5)
- [ ] Add enums
- [ ] Add indexes & unique constraints
- [ ] Add relationships & foreign keys
- [ ] Ensure `designation` field exists separate from `role`
- [ ] Run `npx prisma generate`
- [ ] Create migrations: `npx prisma migrate dev --name initial_schema`

