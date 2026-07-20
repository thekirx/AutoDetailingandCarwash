# Hakum Auto Care Management System
## Owner Requested Modifications
**Version:** 2.0 Feature Planning Document  
**Date:** July 20, 2026  
**Status:** Planning Phase

---

# Overview

This document outlines all requested modifications from the owner for the existing Hakum Auto Care Management System. These are enhancements to the current platform and should be implemented in future development phases.

---

# 1. POS (Point of Sale) Improvements

## 1.1 Products and Services
- Support selling both:
  - Physical Items/Products
  - Services

### Requirements
- POS should allow mixed transactions (items + services).
- Separate inventory handling for products.
- Services should not affect inventory.

---

## 1.2 Loyalty Program

### Requirement
Only **Services** should earn loyalty points.

### Rules

- Customer receives loyalty points only after successful payment.
- Items/products do NOT earn loyalty points.
- Cancelled or unpaid transactions should not generate points.

---

## 1.3 Daily Sales Dashboard

Display:

- Total Sales Today
- Paid Transactions
- Pending Transactions
- Number of Transactions
- Average Transaction Value

Dashboard should update in real time.

---

## 1.4 Square POS Style

Redesign the POS interface inspired by Square POS.

Features:

- Modern clean layout
- Large product/service cards
- Quick search
- Category filtering
- Fast checkout flow
- Customer selection
- Multiple payment methods
- Receipt preview
- Responsive design

---

# 2. Finance Module

---

## 2.1 Daily Sales Summary

Display sales per branch.

Metrics:

- Total Sales
- Paid Sales
- Pending Payments
- Cash Sales
- Online Payments
- Total Transactions

---

## 2.2 Manual Expense Entry

Admins can manually create expenses.

Fields:

- Expense Title
- Description
- Quantity
- Unit Cost
- Total Amount
- Branch
- Expense Category
- Attachment (optional)

---

## 2.3 Approval Workflow

Before posting expenses to the master sheet:

Status Flow:

```
Draft
↓
Pending Approval
↓
Approved
↓
Pending Payment
↓
Paid
↓
Posted to Master Sheet
```

---

### Rules

Before approval:
- Editable

After approval:
- Cannot edit
- Only Super Admin/Owner can modify

---

## 2.4 High Value Expense Approval

Special approval rule:

If:

- Chemical purchase
OR
- Expense > ₱5,000

Require pre-approval before proceeding.

---

## 2.5 Payment Workflow

After approval:

Status becomes:

Pending Payment

After payment:

- Moves into finance records
- Included in reports
- Locked from editing

Only Owner/Super Admin can reopen.

---

## 2.6 Features Similar to Xero

Finance module should eventually include features similar to Xero such as:

- Expense Management
- Approval Workflow
- Financial Reports
- Branch Accounting
- Payment Tracking
- Audit Logs

---

# 3. User Registration Improvements

Required fields:

- First Name
- Last Name
- Phone Number (Required)
- Email (Optional)

---

## Team Lead Information

Store:

- Team Lead Phone Number

---

## Vehicle Registration

When customer registers a vehicle:

Support:

- Car
- Motorcycle

Vehicle Information:

- Plate Number
- Brand
- Model
- Year
- Color
- Vehicle Type

---

# 4. SMS Marketing

Add SMS Marketing module.

Capabilities:

- Promotional SMS
- Service Reminders
- Loyalty Rewards
- Birthday Messages
- Booking Confirmations
- Booking Reminders

Should integrate with current SMS provider.

---

# 5. Crew Management

Add Crew Management module.

Functions:

- Create Crew
- Edit Crew
- Delete Crew
- Assign Branch
- Activate/Deactivate Crew

Permissions:

- Super Admin
- Admin

---

# 6. Service Management

Only:

- Super Admin
- Admin

Can:

- Create Services
- Update Services
- Delete Services

No other roles should modify services.

---

# 7. Booking Board

Create booking page similar to Trello.

Features:

Columns:

- New Booking
- Confirmed
- In Progress
- Waiting
- Completed
- Cancelled

Support:

- Drag and Drop
- Color Labels
- Assigned Crew
- Scheduled Time
- Customer Details

---

## Access

Can access:

- Super Admin
- Admin
- Marketing

---

# 8. New Marketing Role

Create Marketing role.

Permissions:

- View Bookings
- Manage Bookings
- Access CRM
- Customer Information
- Marketing Campaigns

Restrictions:

Cannot access:

- Sales
- Finance
- Reports

---

# 9. CRM Access

Marketing users may access:

- Customer Profile
- Contact Information
- Vehicle Information
- Booking History
- Loyalty Information

Cannot view:

- Sales
- Financial Records

---

# 10. Sales Role

Create Sales role.

Permissions:

Same as Marketing plus:

Booking:

- Create
- Read
- Update

Cannot:

- Delete bookings
- Access finance
- Manage services

---

# 11. Contact Us Module

Add Contact Us page.

Fields:

- Name
- Phone Number
- Email
- Subject
- Message

Upon submission:

- Send email immediately to Hakum support
- Save inquiry in database

---

# 12. Complaint Submission

Customers can submit complaints.

Fields:

- Customer Name
- Branch
- Booking
- Complaint Category
- Description
- Attachment

Workflow:

Submitted
→ Review
→ Resolved
→ Closed

Email notification should be sent immediately.

---

# 13. Events Page

Create Events page.

Purpose:

- Promotions
- Branch Events
- Car Meets
- Seasonal Campaigns

Features:

- Event Banner
- Registration
- Schedule
- Branch
- Description

---

# 14. Membership Pricing

Add premium membership plans.

Example:

## Platinum Membership

Display:

- Starting Price
- Benefits
- Discounts
- Loyalty Multiplier
- Included Services

Future-proof system for multiple membership tiers.

---

# 15. Reports & Analytics

Dashboard similar to Square Reports.

Metrics:

## Sales

- Daily Sales
- Weekly Sales
- Monthly Sales
- Yearly Sales

---

## Performance

- Sales Growth %
- Branch Performance %
- Service Performance %
- Staff Performance %
- Customer Retention %
- Repeat Customers %
- Conversion Rate %

---

## Charts

Include:

- Revenue Trend
- Sales by Branch
- Best Selling Services
- Best Selling Products
- Customer Growth
- Loyalty Usage

---

# 16. User Roles Summary

| Module | Super Admin | Admin | Marketing | Sales | Crew |
|---------|------------|-------|-----------|-------|------|
| POS | ✅ | ✅ | ❌ | ✅ | ❌ |
| Finance | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Services CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crew CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bookings | ✅ | ✅ | Read/Update | Create/Read/Update | Assigned Only |
| CRM | ✅ | ✅ | ✅ | ✅ | ❌ |
| Marketing | ✅ | ✅ | ✅ | ❌ | ❌ |

---

# 17. Priority Roadmap

## Phase 1 (High Priority)

- POS Improvements
- Loyalty System
- Finance Approval Workflow
- Daily Sales Dashboard
- User Registration Improvements

---

## Phase 2 (Medium Priority)

- SMS Marketing
- Crew Management
- Marketing Role
- Sales Role
- CRM Enhancements

---

## Phase 3 (Medium Priority)

- Trello-style Booking Board
- Contact Us
- Complaint Module
- Events Page

---

## Phase 4 (Future Enhancements)

- Premium Membership Plans
- Advanced Reports (Square-style)
- Xero-inspired Finance Features
- Branch Performance Analytics
- Executive Dashboard

---

# Expected Outcome

The requested modifications will transform the current Hakum Auto Care Management System into a more comprehensive enterprise platform with:

- A modern Square-inspired POS experience.
- A structured finance module with approval workflows.
- Role-based access control for Marketing, Sales, Admin, and Crew.
- Enhanced CRM and booking management.
- SMS marketing capabilities.
- Membership and loyalty enhancements.
- Advanced reporting and analytics for business performance.
- Better scalability for multi-branch operations.
```