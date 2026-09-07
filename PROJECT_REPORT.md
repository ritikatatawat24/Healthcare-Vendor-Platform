# MedVendor Project Report

## 1. Executive Summary

MedVendor is a full-stack healthcare procurement platform built to connect buyers such as hospitals, pharmacies, NGOs, and clinics with suppliers offering medical products and services. The platform supports supplier onboarding, buyer onboarding, catalog management, RFQ publishing, quotation submission, purchase-order generation, order tracking, subcontracting flows, and admin-led approval of new users.

The project is structured as:

- `frontend/`: Next.js 16 + React 19 application
- `backend/`: Django 5 + Django REST Framework API
- `database`: PostgreSQL (configured for Render/Supabase-style deployment)

The product is designed around two primary business roles:

- `buyer`: raises procurement requests and manages orders
- `supplier`: publishes listings, responds to RFQs, and fulfills orders

There is also an `admin` session flow used for user review and approval.

---

## 2. Technology Stack

### Frontend

- Framework: Next.js `16.1.6`
- UI Library: React `19.2.3`
- Language: TypeScript
- Styling: global CSS with utility-style classes
- HTTP Client: Axios

### Backend

- Framework: Django `5.x`
- API Layer: Django REST Framework
- Auth: DRF token authentication + custom admin authentication
- CORS: `django-cors-headers`
- Static hosting: WhiteNoise
- Application server: Gunicorn

### Database

- Primary database engine: PostgreSQL

### Deployment

- Backend deployment target: Render
- Frontend deployment target: Vercel

---

## 3. High-Level Architecture

### Frontend Responsibilities

The frontend provides:

- public marketing and tender discovery pages
- authentication flows
- role-based dashboards
- profile setup and verification forms
- product/service catalog management
- RFQ and quotation workflows
- order management and analytics
- admin approval workspace

### Backend Responsibilities

The backend provides:

- user registration, login, logout, and password reset
- role resolution and approval enforcement
- buyer and supplier profile persistence
- product/service CRUD operations
- RFQ lifecycle handling
- quotation submission, edit, award, and rejection
- purchase-order creation and tracking
- order event logging and subcontract/reorder flows

### Core Business Workflow

1. User registers as buyer or supplier.
2. User completes profile setup.
3. Admin reviews and approves access.
4. Supplier creates catalog listings.
5. Buyer creates an RFQ.
6. Suppliers submit quotations against matching listings.
7. Buyer awards a quotation.
8. System creates or links a purchase order.
9. Supplier accepts and updates fulfillment stages.
10. Buyer confirms receipt and payment.

---

## 4. Frontend Page Inventory

## Public and Authentication Pages

### `/`

- Component: `frontend/app/page.tsx` -> `PublicLandingPage`
- Purpose: public home page and marketplace introduction
- Key functions:
  - loads public RFQs
  - shows active tender volume and buyer activity
  - promotes buyer and supplier onboarding
  - redirects authenticated users to role-specific dashboards

### `/login`

- Component: `AuthScreen`
- Purpose: login for buyers, suppliers, and admin
- Behavior:
  - supports redirect via `next` query param
  - detects existing session and redirects accordingly

### `/register`

- Component: `AuthScreen`
- Purpose: account creation
- Behavior:
  - supports buyer and supplier registration
  - buyer registration requires buyer type
  - supplier registration seeds a basic vendor profile

## Buyer Pages

### `/buyer/profile`

- Component: `ProfileSetupWorkspace role="buyer"`
- Purpose: buyer onboarding and profile completion
- Captures:
  - organization information
  - procurement contact information
  - spending and approval details
  - compliance needs
  - onboarding documents
  - location details

### `/buyer/dashboard`

- Component: `frontend/app/buyer/dashboard/page.tsx`
- Purpose: buyer command center
- Main capabilities:
  - summary metrics for RFQs, quotes, spend, and suppliers
  - recent order and RFQ activity
  - searchable procurement ledger
  - dashboard export snapshot as JSON
  - session enforcement and role-based redirect

### `/buyer/products`

- Component: `ProductWorkspacePage`
- Purpose: buyer-side catalog browsing
- Key functions:
  - reads active supplier products/services
  - supports filtering/search of available listings
  - redirects suppliers to supplier product route

### `/buyer/rfq`

- Component: `RfqWorkspacePage`
- Purpose: buyer RFQ management workspace
- Key functions:
  - create RFQs
  - edit RFQs
  - upload or replace tender document PDFs
  - invite selected suppliers for limited tenders
  - review quotations
  - reject quotations
  - award quotations and generate PO
  - close, reopen, and delete RFQs

### `/buyer/orders`

- Component: `OrderWorkspacePage`
- Purpose: buyer order management workspace
- Key functions:
  - view released and completed orders
  - mark goods as received
  - record dummy payment
  - create reorders from prior orders

### `/buyer/analytics`

- Current behavior: redirects to `/buyer/dashboard`
- Observation: buyer analytics page is not implemented as a distinct analytics workspace yet

## Supplier Pages

### `/supplier/profile`

- Component: `ProfileSetupWorkspace role="supplier"`
- Purpose: supplier onboarding and verification profile
- Captures:
  - company and brand information
  - GST and license identifiers
  - category and supply-region coverage
  - bank and operational details
  - compliance/verification documents
  - geolocation details

### `/supplier/dashboard`

- Component: `frontend/app/supplier/dashboard/page.tsx`
- Purpose: supplier operations dashboard
- Main capabilities:
  - order, RFQ, and catalog metrics
  - supplier-side activity feed
  - quick access to product, RFQ, and order workflows

### `/supplier/products`

- Component: `SupplierNewProductPage`
- Current behavior:
  - route maps to the new-product screen instead of a list workspace
- Observation:
  - this route naming suggests a catalog list page, but currently opens create-product UI

### `/supplier/products/new`

- Component: `SupplierNewProductPage`
- Purpose: create a new product or service listing
- Captures:
  - name
  - description
  - product/service type
  - price
  - stock

### `/supplier/rfq`

- Component: `RfqWorkspacePage`
- Purpose: supplier RFQ response workspace
- Key functions:
  - view open and invited RFQs
  - submit quotations
  - edit own quotations before lock
  - see only own quotations on non-owned RFQs

### `/supplier/orders`

- Component: `OrderWorkspacePage`
- Purpose: supplier order execution workspace
- Key functions:
  - accept purchase orders
  - update tracking and delivery status
  - mark payment overdue
  - create subcontract RFQs for shortages

### `/supplier/analytics`

- Component: `SupplierAnalyticsPage`
- Purpose: supplier performance and procurement analytics
- Visuals and insights:
  - spending trends
  - supplier/product performance
  - category breakdown
  - active RFQ and revenue indicators

### `/supplier/settings`

- Component: `frontend/app/supplier/settings/page.tsx`
- Purpose: account settings
- Current capability:
  - password reset

## Admin Pages

### `/admin/dashboard`

- Component: `frontend/app/admin/dashboard/page.tsx`
- Purpose: admin approval and user vetting panel
- Main capabilities:
  - load all buyer and supplier accounts
  - filter by role and status
  - inspect full verification data
  - preview uploaded documents
  - approve or reject access

## Vendor Alias Routes

The project also contains vendor-prefixed routes:

- `/vendor/products`
- `/vendor/products/new`
- `/vendor/rfq`
- `/vendor/orders`
- `/vendor/analytics`

These currently map to supplier-oriented components and appear to function as alias routes rather than a separate third role.

---

## 5. Shared Frontend Modules

### `ProfileSetupWorkspace`

- central onboarding/profile editor for both buyer and supplier roles
- loads current user + current profile
- saves role-specific fields
- refreshes session state after profile update

### `ProductWorkspacePage`

- shared catalog workspace
- supplier users manage their own listings
- buyer users browse active available listings

### `RfqWorkspacePage`

- most important shared business module
- changes behavior based on user role and auth state
- supports both public RFQ viewing and authenticated RFQ operations

### `OrderWorkspacePage`

- shared order module
- exposes different actions based on whether the session is buyer or supplier

### `SupplierAnalyticsPage`

- shared analytics screen for supplier/vendor routes

---

## 6. Backend API Inventory

Base API prefix: `/api/vendor/`

## Authentication and Profile

- `POST /auth/register/`
  - creates buyer or supplier account
- `POST /auth/login/`
  - logs in standard users or admin
- `GET /auth/me/`
  - returns authenticated session user
- `POST /auth/logout/`
  - destroys token for standard users
- `POST /auth/reset-password/`
  - resets password and rotates token
- `GET /auth/profile/`
  - loads buyer or supplier profile
- `POST /auth/profile/update/`
  - updates current user profile

## Admin

- `GET /auth/admin/users/`
  - fetches all buyer and supplier accounts with verification data
- `POST /auth/admin/users/<id>/status/`
  - approves or rejects an account

## Product/Service Catalog

- `GET /products/`
  - supplier sees own listings
  - non-supplier sees active listings
- `POST /products/`
  - supplier creates listing
- `PATCH /products/<id>/`
  - supplier edits own listing
- `DELETE /products/<id>/`
  - supplier deletes own listing

## Orders

- `GET /orders/`
  - returns orders where current user is buyer or supplier
- `POST /orders/`
  - creates order
- `POST /orders/<id>/accept-po/`
  - supplier accepts PO
- `POST /orders/<id>/update-tracking/`
  - supplier updates status/tracking
- `POST /orders/<id>/mark-received/`
  - buyer confirms goods receipt
- `POST /orders/<id>/make-payment/`
  - buyer records payment
- `POST /orders/<id>/mark-payment-overdue/`
  - supplier flags overdue payment
- `POST /orders/<id>/subcontract/`
  - supplier creates shortage RFQ
- `POST /orders/<id>/reorder/`
  - buyer duplicates order

## RFQs and Quotations

- `GET /rfqs/`
  - public users see only live RFQs
  - buyers see own RFQs
  - suppliers see open, invited, or self-created subcontract RFQs
- `POST /rfqs/`
  - creates RFQ
- `PATCH /rfqs/<id>/`
  - updates own RFQ if not awarded
- `DELETE /rfqs/<id>/`
  - deletes own RFQ if not awarded
- `POST /rfqs/<id>/submit-quotation/`
  - supplier submits quotation
- `PATCH /rfqs/<id>/quotations/<quotation_id>/edit/`
  - supplier edits own quotation
- `POST /rfqs/<id>/award/`
  - buyer awards quotation and creates/links PO
- `POST /rfqs/<id>/reject-quotation/`
  - buyer rejects quotation
- `POST /rfqs/<id>/close/`
  - buyer closes RFQ
- `POST /rfqs/<id>/reopen/`
  - buyer reopens RFQ

---

## 7. Database Design

The database is centered around user identity, business profiles, procurement requests, vendor quotations, and order execution.

## Core Tables

### `medvendor_account_profiles`

Purpose:
- stores platform role and approval status for each Django user

Key fields:
- `user`
- `role` (`supplier` or `buyer`)
- `status` (`pending`, `approved`, `rejected`)
- `buyer_type`
- `created_at`

### `medvendor_buyer_profiles`

Purpose:
- stores detailed buyer organization and procurement data

Key fields:
- organization details
- department and institution size
- GST number
- address, city, state, pincode
- procurement contact details
- monthly spend
- payment terms
- approval flow
- categories needed
- delivery locations
- urgency window
- compliance needs
- onboarding documents
- latitude / longitude
- timestamps

### `medvendor_vendor_profiles`

Purpose:
- stores supplier identity, operational details, and verification evidence

Key fields:
- company and brand name
- GST and license data
- business category
- years in business
- address details
- contact details
- product categories and supply regions
- minimum order value
- average lead time
- warehouse capacity
- banking information
- GST document
- license document
- ISO certificate
- latitude / longitude
- verification status
- timestamps

### `medvendor_vendor_product_services`

Purpose:
- supplier catalog of products and services

Key fields:
- `vendor`
- `name`
- `description`
- `product_type`
- `price`
- `stock`
- `is_active`
- `created_at`

### `medvendor_vendor_rfqs`

Purpose:
- procurement request raised by buyer or by supplier during subcontracting

Key fields:
- `buyer`
- RFQ title and description
- product/service type
- quantity
- target budget
- delivery location
- expected delivery date
- quotation deadline
- tender document and note
- tender type (`open`, `limited`, `reverse`)
- status (`open`, `under_review`, `awarded`, `closed`)
- buyer company and buyer type snapshot
- awarded quotation/vendor/order references
- source order reference for subcontract flow
- source type
- created timestamp

### `medvendor_vendor_rfq_invitations`

Purpose:
- supports limited tenders by mapping invited suppliers to RFQs

Key fields:
- `rfq`
- `vendor`

### `medvendor_vendor_quotations`

Purpose:
- supplier responses to RFQs

Key fields:
- `rfq`
- `supplier_vendor`
- supplier identity snapshot
- selected product
- quoted unit price
- lead time
- validity
- notes
- status (`submitted`, `rejected`, `awarded`)
- rejection reason
- rejected timestamp
- created timestamp

### `medvendor_vendor_orders`

Purpose:
- purchase order and fulfillment lifecycle record

Key fields:
- `buyer`
- `vendor`
- status
- payment status
- delivery status
- tracking note
- PO release/accept/shipped/delivered/received timestamps
- total amount
- created timestamp

### `medvendor_vendor_order_items`

Purpose:
- line items for an order

Key fields:
- `order`
- `product`
- `quantity`
- `price`

### `medvendor_vendor_order_events`

Purpose:
- audit trail of order actions

Key fields:
- `order`
- event type
- actor role and actor name
- message
- created timestamp

---

## 8. Key Business Rules Implemented

### Access Control

- suppliers can manage only their own products
- buyers can manage only their own RFQs
- suppliers can edit only their own quotations
- buyers can manage only their own orders on buyer actions
- suppliers can manage only their own orders on fulfillment actions
- rejected users are denied platform access
- default permissions require approved users

### RFQ Rules

- public users can view only open/under-review RFQs
- quotation deadline cannot be in the past
- expected delivery must not be before quote deadline
- limited tenders require invited vendors
- only invited vendors may quote on limited tenders
- awarded RFQs cannot be edited or deleted

### Order Rules

- accepting a PO changes status and logs an event
- moving into dispatch/shipping reduces supplier stock
- receiving goods may complete the order depending on payment status
- payment updates and tracking updates create order events
- shortage handling can create subcontract RFQs

---

## 9. File and Document Handling

The platform supports document capture in multiple places:

- RFQ tender documents:
  - PDF upload only
  - max size: 10 MB
  - stored under `media/rfq_documents/`

- Supplier verification documents:
  - GST document
  - license document
  - ISO certificate

- Buyer onboarding documents:
  - stored in profile payload and previewed in admin workspace

Admin can preview or download submitted verification material from the approval panel.

---

## 10. Deployment and Environment

## Backend Deployment

`render.yaml` defines:

- PostgreSQL database service
- Python web service for Django backend
- build command:
  - install requirements
  - collect static files
- start command:
  - run migrations
  - start Gunicorn

## Backend Environment Variables

Important backend environment variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- Supabase fallback variables for direct PostgreSQL connection

## Frontend Environment Variables

Important frontend environment variable:

- `NEXT_PUBLIC_API_BASE_URL`

---

## 11. Current Strengths

- clear separation between frontend and backend
- good role-based workflow coverage
- end-to-end RFQ to order lifecycle is implemented
- shared workspaces reduce duplicate frontend logic
- admin review flow is included
- audit logging exists for order lifecycle changes
- deployment scaffolding for Render and Vercel is already present

---

## 12. Observations and Improvement Opportunities

### Functional Observations

- `/buyer/analytics` currently redirects to dashboard instead of rendering a dedicated analytics page
- `/supplier/products` currently points to the create-product screen rather than a separate list/catalog workspace
- `/vendor/*` routes appear to be supplier aliases and may cause naming confusion

### Technical Observation

- `backend/config/settings.py` appears to define conditional database selection first, but then unconditionally reassigns `DATABASES` to the Supabase-style configuration later in the file. This may override `DATABASE_URL` parsing and should be reviewed carefully.

### Suggested Next Improvements

- create a dedicated buyer analytics page
- separate supplier product list and supplier product creation routes more clearly
- formalize document storage strategy for profile uploads
- add automated tests for RFQ, quotation, and order transitions
- add API documentation or OpenAPI schema
- add role-based navigation guards in a shared middleware or central auth wrapper

---

## 13. Recommended Presentation Summary

If this project is being presented professionally, it can be described as:

> MedVendor is a healthcare procurement platform that digitizes the complete sourcing lifecycle, from supplier onboarding and catalog creation to RFQ publication, quotation comparison, PO release, fulfillment tracking, and administrative compliance review.

Best positioning themes:

- B2B healthcare marketplace
- procurement workflow automation
- supplier discovery and tendering
- operational visibility and auditability
- role-based procurement management

---

## 14. Source Structure Summary

### Frontend Key Folders

- `frontend/app/`: route entry points
- `frontend/components/`: reusable UI and page workspaces
- `frontend/services/`: API service layer
- `frontend/types/`: shared frontend types
- `frontend/public/`: static assets and marketing images

### Backend Key Folders

- `backend/config/`: Django settings and URL config
- `backend/vendor/models/`: database schema
- `backend/vendor/views/`: API endpoints and business actions
- `backend/vendor/serializers/`: API validation and representation
- `backend/vendor/utils/`: admin auth, role helpers, order event logging
- `backend/vendor/migrations/`: schema evolution

---

## 15. Conclusion

This project is already structured like a real procurement product rather than a simple CRUD demo. Its strongest business value lies in connecting supplier catalog management, RFQ-based procurement, quotation comparison, PO issuance, and fulfillment tracking inside one workflow. With a few refinements around route consistency, analytics separation, database configuration review, and formal API/testing coverage, it can be presented as a strong professional full-stack marketplace and procurement management system.
