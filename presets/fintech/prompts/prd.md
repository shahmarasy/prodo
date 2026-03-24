# Fintech Preset - PRD Generation Context

## Preset Overview
**Domain**: Financial Technology (FinTech)
**Focus**: Regulatory compliance, security, transaction integrity, fraud prevention
**Target Industries**: Banking, Payment Processing, Investment Management, Lending, Blockchain

## Critical Requirements for FinTech Products

### 1. Regulatory Compliance
- **KYC/AML**: Know Your Customer, Anti-Money Laundering regulations
- **PCI DSS**: Payment Card Industry Data Security Standard (Level 1-4)
- **SOC 2**: System and Organization Controls compliance
- **GDPR/Regional**: Data privacy and regional financial regulations
- **Audit Trail**: Complete transaction and action audit logs required

### 2. Security Requirements
- **Encryption**: End-to-end encryption for sensitive data (at-rest & in-transit)
- **Authentication**: Multi-factor authentication (MFA) mandatory
- **Authorization**: Role-based access control (RBAC) with least privilege
- **Fraud Detection**: Real-time anomaly detection and transaction monitoring
- **Penetration Testing**: Regular security audits and penetration tests

### 3. Transaction Management
- **Settlement**: Fast settlement with reconciliation (T+0, T+1, etc.)
- **Atomicity**: All-or-nothing transaction guarantees
- **Idempotency**: Prevent duplicate transactions
- **Error Handling**: Graceful failures with clear audit trails
- **Dispute Resolution**: Clear process for chargebacks and disputes

### 4. Risk Management
- **Fraud Detection**: ML-based anomaly detection and rule engines
- **Risk Assessment**: Transaction risk scoring and limits
- **Compliance Monitoring**: Continuous regulatory compliance monitoring
- **Incident Response**: Clear escalation and response procedures
- **Business Continuity**: Disaster recovery and failover strategies

### 5. User Personas (FinTech Specific)
- **Compliance Officer**: Regulatory requirements, audit trails, risk reporting
- **Risk Manager**: Fraud patterns, transaction limits, risk scoring
- **Treasury Manager**: Settlement timing, liquidity management, cash flow
- **Customer Service**: Transaction history, dispute handling, user support
- **Auditor**: Complete audit trails, compliance reports, system integrity

### 6. Success Metrics (FinTech Specific)
- **Compliance Rate**: 100% regulatory adherence (zero violations target)
- **Transaction Volume**: Daily/monthly transaction throughput
- **Fraud Detection Rate**: % of fraudulent transactions caught pre-settlement
- **Settlement Speed**: Average time to settlement completion
- **System Uptime**: 99.99%+ availability (critical infrastructure)
- **Customer Trust**: Chargeback rate, dispute resolution time

### 7. Key Constraints
- **Regulatory Deadlines**: Compliance cutoffs, reporting deadlines
- **Data Residency**: Geographic restrictions on data storage
- **Transaction Limits**: Daily/monthly limits per user/transaction type
- **Integration Requirements**: Payment gateways, banking APIs, clearing houses
- **Audit Requirements**: Immutable logs, compliance reports, regulatory filings

## PRD Generation Guidelines

### Domain-Specific Terminology
Use fintech-standard terminology:
- KYC (Know Your Customer) vs. identity verification
- AML (Anti-Money Laundering) vs. fraud prevention
- SCA (Strong Customer Authentication) vs. verification
- PCI DSS (Payment Card Industry Standard) vs. security
- Settlement vs. transaction completion
- Reconciliation vs. balance verification

### Feature Prioritization
1. **Compliance first**: All features must meet regulatory requirements
2. **Security second**: Security cannot be compromised for features
3. **User experience**: Within compliance and security boundaries
4. **Performance**: Transaction speed critical for user satisfaction

### Risk Assessment
Flag high-risk features:
- ⚠️ Features involving cross-border transactions
- ⚠️ Features with regulatory uncertainty
- ⚠️ Features with no clear audit trail mechanism
- ⚠️ Features involving sensitive financial data

### Documentation Standards
- **Compliance Mapping**: Each feature → applicable regulations
- **Security Justification**: Why security approach chosen
- **Audit Trail**: How feature activities are logged
- **Error Scenarios**: Failure modes and recovery
- **Rollback Strategy**: How to undo transactions if needed

## Validation Checklist
Before finalizing PRD, verify:
- ✅ All features have compliance mapping
- ✅ Security requirements explicitly stated
- ✅ Audit trail mechanisms defined
- ✅ Risk assessment completed
- ✅ Regulatory deadlines documented
- ✅ User personas fintech-specific
- ✅ Success metrics measurable
- ✅ Escalation procedures clear
