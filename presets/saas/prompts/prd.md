# SaaS Preset - PRD Generation Context

## Preset Overview
**Domain**: Software as a Service (SaaS)
**Focus**: Subscription economics, customer success, enterprise integration, scalability, recurring revenue
**Target Models**: Enterprise Software, Business Tools, Vertical SaaS, Workflow Automation, Analytics

## Critical Requirements for SaaS Products

### 1. Subscription Business Model
- **Pricing Tiers**: Free/Freemium, Starter, Professional, Enterprise
- **Billing Cycle**: Monthly, annual, or usage-based
- **Per-Seat vs. Fixed**: User-based vs. flat-rate pricing
- **Feature Gating**: Which features per tier
- **Contract Terms**: Auto-renewal, cancellation terms, trial periods

### 2. Customer Onboarding & Adoption
- **Self-Serve Onboarding**: Guided setup, templates, presets
- **Product-Led Growth**: Feature discoverability, in-app education
- **User Training**: Tutorials, help center, webinars, documentation
- **Activation**: Time to first value, key engagement metrics
- **Expansion Path**: Upsell opportunities, feature education

### 3. Enterprise Integration
- **SSO/SAML**: Single sign-on for corporate users
- **APIs**: REST/GraphQL APIs for custom integrations
- **Webhooks**: Real-time event notifications
- **Data Export**: Export capabilities, compliance
- **Native Integrations**: Slack, Salesforce, HubSpot, Jira, etc.

### 4. Scalability & Multi-Tenancy
- **Tenant Isolation**: Data separation and security
- **Performance**: Sub-second response times
- **Availability**: 99.9% or 99.99% uptime SLA
- **Disaster Recovery**: Backup, replication, failover
- **Geographic Distribution**: Multi-region support

### 5. Customer Success & Retention
- **Onboarding Support**: Dedicated CSM for enterprise accounts
- **Health Scoring**: Identify at-risk customers proactively
- **Usage Analytics**: Monitor feature adoption and user behavior
- **Support Tiers**: Community, email, chat, phone, 24/7
- **Renewal Playbook**: Steps to improve retention

### 6. Compliance & Data Governance
- **SOC 2**: Security, availability, confidentiality standards
- **HIPAA**: For healthcare SaaS
- **GDPR/CCPA**: Data privacy and right to deletion
- **Data Residency**: Geographic data storage requirements
- **Audit Trails**: Logging for compliance audits

### 7. User Personas (SaaS Specific)

#### End User
- Goals: Solve their job efficiently, learn easily
- Pain Points: Complex workflows, context-switching, training
- Concerns: Time investment, productivity gain

#### Admin/IT
- Goals: Secure deployment, central management, compliance
- Pain Points: User management overhead, security config
- Concerns: Data security, compliance, integration complexity

#### Finance Lead
- Goals: ROI justification, cost optimization, budgeting
- Pain Points: License management, usage visibility
- Concerns: TCO, renewal negotiations, cost per user

#### Customer Success Manager
- Goals: Customer adoption, expansion, retention
- Pain Points: Health scoring accuracy, expansion opportunities
- Concerns: Churn prevention, engagement metrics, renewal success

#### Developer (if applicable)
- Goals: Easy integration, extensibility, good documentation
- Pain Points: API limitations, rate limits, debugging
- Concerns: Developer experience, SDK quality, support

### 8. Success Metrics (SaaS Specific)
- **Monthly Recurring Revenue (MRR)**: Predictable revenue base
- **Annual Recurring Revenue (ARR)**: Annualized MRR
- **Customer Acquisition Cost (CAC)**: Cost to acquire customer
- **Lifetime Value (LTV)**: Total revenue per customer
- **LTV:CAC Ratio**: Should be 3:1 or higher (industry standard)
- **Churn Rate**: Monthly % of customers leaving
- **Net Revenue Retention (NRR)**: Retention + expansion
- **Customer Health Score**: Predictive churn indicator
- **Net Promoter Score (NPS)**: Customer satisfaction
- **Time to Value (TTV)**: Days to first value realization

### 9. Key Constraints
- **Uptime SLA**: 99.9% minimum (often 99.99% expected)
- **Data Residency**: Specific geographic regions required
- **Integration Requirements**: Must support popular tools
- **Pricing Sensitivity**: Competitive pricing pressure
- **Contract Terms**: Annual vs. monthly, lock-in periods
- **Support Costs**: Scale with customer base and tier
- **Regulatory Requirements**: Compliance obligations

## PRD Generation Guidelines

### Subscription-First Thinking
- Every feature → How does it impact retention?
- Every feature → Expansion opportunity or anti-churn?
- Every feature → Which tier includes it?
- Pricing change → Impact on LTV and churn?

### Customer Success Playbook
- How do we onboard customers?
- How do we measure adoption?
- How do we identify expansion opportunities?
- How do we prevent churn?
- What's the health scoring model?

### Enterprise Requirements
- What integrations are table-stakes?
- What compliance is required?
- What's the uptime SLA?
- What's the support model?
- What's the pricing model for enterprise?

### API-First Design
- What's exposed via API?
- What data can be exported?
- What webhooks/events exist?
- Rate limiting strategy?
- Documentation quality?

### Scalability Considerations
- How does the system scale to 10k users?
- How does the system scale to 100k users?
- What's the performance baseline?
- What monitoring is needed?
- What's the disaster recovery plan?

## Validation Checklist
Before finalizing PRD, verify:
- ✅ Pricing model clearly defined (tiers, billing, trial)
- ✅ Onboarding flow documented (self-serve path)
- ✅ Key integrations listed
- ✅ SLA/uptime committed (99.9% minimum)
- ✅ Compliance requirements identified
- ✅ Customer success strategy outlined
- ✅ Health scoring model conceptualized
- ✅ Support tier structure defined
- ✅ Churn prevention strategy exists
- ✅ Expansion/upsell opportunities identified
- ✅ API strategy documented
- ✅ Multi-tenancy approach clear
- ✅ Disaster recovery plan outlined
- ✅ Geographic expansion strategy noted
