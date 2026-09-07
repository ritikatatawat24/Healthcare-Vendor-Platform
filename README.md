MedVendor — Healthcare Vendor & Procurement Platform

MedVendor is a full-stack healthcare procurement platform designed to connect buyers such as hospitals, pharmacies, NGOs, and clinics with suppliers/vendors offering medical products and services.

The platform digitizes the procurement lifecycle from supplier onboarding and catalog management to RFQs, quotations, purchase orders, fulfillment tracking, and administrative approval.

🚀 Key Features

Buyer

Buyer registration and profile onboarding

Browse active supplier products and services

Create, edit, and manage RFQs

Upload tender documents

Invite selected suppliers for limited tenders

Review and reject quotations

Award quotations and generate/link purchase orders

Track orders and confirm goods receipt

Record payments

Create reorders from previous orders

Procurement dashboard with RFQ, quote, spend, and supplier metrics

Supplier / Vendor

Supplier registration and verification

Company, GST, license, compliance, and operational profile

Create and manage product/service listings

Respond to open or invited RFQs

Submit and edit quotations before lock

Manage purchase orders

Accept POs and update tracking/delivery status

Track payment status

Create subcontract RFQs for shortages

Supplier performance and procurement analytics

Admin

Review buyer and supplier accounts

Filter users by role and status

Inspect verification information

Preview submitted documents

Approve or reject platform access

🔄 Procurement Workflow

Buyer / Supplier Registration
            ↓
      Profile Setup
            ↓
     Admin Approval
            ↓
   Supplier Catalog Setup
            ↓
       Buyer Creates RFQ
            ↓
     Suppliers Submit Quotes
            ↓
      Buyer Awards Quote
            ↓
    Purchase Order Created
            ↓
    Supplier Accepts PO
            ↓
   Fulfillment & Tracking
            ↓
       Buyer Receives
            ↓
          Payment

🛠️ Technology Stack

Frontend

Next.js 16

React 19

TypeScript

Utility-style CSS / Tailwind-oriented styling

Axios

Backend

Django 5

Django REST Framework

DRF Token Authentication

Custom Admin Authentication

django-cors-headers

WhiteNoise

Gunicorn

Database

PostgreSQL

Deployment

Frontend: Vercel

Backend: Render

🏗️ Project Structure

Healthcare-Vendor-Platform/
│
├── frontend/
│   ├── app/              # Next.js routes and pages
│   ├── components/       # Reusable UI components and workspaces
│   ├── services/         # API service layer
│   ├── types/            # Shared TypeScript types
│   └── public/            # Static assets
│
├── backend/
│   ├── config/           # Django settings and URL configuration
│   └── vendor/
│       ├── models/       # Database models
│       ├── views/        # API endpoints and business logic
│       ├── serializers/  # API validation and representation
│       ├── utils/        # Authentication, roles, and order events
│       └── migrations/   # Database migrations
│
├── Vendor/               # Vendor-prefixed frontend routes
├── PROJECT_REPORT.md     # Detailed project documentation
├── render.yaml           # Backend deployment configuration
└── README.md

🔐 Role-Based Access

The platform supports three session flows:

Role

Main Responsibilities

Buyer

Procurement requests, RFQs, quotations, orders and payments

Supplier

Catalog, quotations, purchase orders and fulfillment

Admin

User verification and access approval

Access rules ensure that users can manage only the resources relevant to their role and ownership.

📦 Core Procurement Modules

Product & Service Catalog

Suppliers can create product/service listings containing information such as name, description, type, price, stock, and active status.

RFQ & Quotation Management

Buyers can publish procurement requests, set quantities and budgets, specify delivery requirements, upload tender documents, and invite suppliers for limited tenders.

Suppliers can respond with quotations including pricing, lead time, validity, and notes.

Purchase Orders & Fulfillment

When a quotation is awarded, the system can create or link a purchase order. Suppliers can accept POs and update fulfillment/tracking information, while buyers can confirm receipt and record payment.

Audit Trail

Order actions generate order events containing the event type, actor role/name, message, and timestamp.

⚙️ Environment Variables

Backend

The backend uses environment variables including:

DJANGO_SECRET_KEY=
DJANGO_DEBUG=
DJANGO_ALLOWED_HOSTS=
CORS_ALLOWED_ORIGINS=
CSRF_TRUSTED_ORIGINS=
DATABASE_URL=

Supabase-style PostgreSQL fallback variables may also be used according to the backend configuration.

Frontend

NEXT_PUBLIC_API_BASE_URL=

Keep .env and .env.local files private. Never commit API keys, passwords, database credentials, or other secrets to a public repository.

📄 Documentation

For a detailed technical breakdown of the application, including:

Frontend pages and routes

Backend API inventory

Database design

Business rules

Document handling

Deployment configuration

Current limitations and improvement opportunities

see PROJECT_REPORT.md.

📸 Screenshots

Add screenshots of the main application screens here, for example:

Public landing page

Buyer dashboard

Supplier dashboard

Product management

RFQ workspace

Quotation workflow

Order management

Admin approval panel

Supplier analytics

🌐 Live Demo

Frontend: Coming soon

Backend API: Coming soon

💻 Project Highlights

Full-stack architecture with separate Next.js frontend and Django REST backend

Role-based buyer, supplier, and admin workflows

End-to-end RFQ-to-order procurement lifecycle

Shared frontend workspaces for role-specific operations

Supplier verification and admin approval flow

PostgreSQL-based data model

Order event/audit logging

Deployment configuration for Render and Vercel

🔮 Future Improvements

Potential improvements identified for the current project include:

Dedicated buyer analytics workspace

Separate supplier catalog list and product creation routes

Formal document storage strategy

Automated tests for RFQ, quotation, and order transitions

OpenAPI/API documentation

Centralized role-based navigation guards

Review and refinement of database configuration

📌 Project Summary

MedVendor is a healthcare procurement platform that digitizes the complete sourcing lifecycle, from supplier onboarding and catalog creation to RFQ publication, quotation comparison, PO release, fulfillment tracking, and administrative compliance review.

Portfolio Positioning

B2B Healthcare Marketplace • Procurement Workflow Automation • Supplier Discovery • Tendering • Order Management • Role-Based Access Control • Auditability

Built with Next.js, React, TypeScript, Django REST Framework, and PostgreSQL.