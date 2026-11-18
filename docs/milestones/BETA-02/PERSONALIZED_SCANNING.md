# Personalized Scanning & Notification Routing Architecture

**Milestone:** `BETA-02`  
**Purpose:** Ensure scans operate against user-specific preferences and deliver strictly to the requester.

---

## 1. Architectural Flow

```text
[Telegram Inbound: /scan]
       │
       ▼
[Central Auth Guard] ──(Validates BETA-01 Grant)
       │
       ▼
[Identity Service] ────(Resolves acorn_user_id)
       │
       ▼
[Profile Repository] ──(Loads User's Target Roles & Locations)
       │
       ├─► (No Roles Configured?) ──► [Prompt /setroles Onboarding & Exit]
       │
       ▼
[User Scan Request Created] ──(Bound to User & Recipient Chat ID)
       │
       ▼
[Job Ingestion & Matching Engine]
       │ 
       ▼
[Delivery Router]
       │
       ▼ (Recipient Strictly Verified)
[Delivered Exclusively to Requester's Telegram Chat ID]
```

## 2. Key Safeguards
1. **Zero-Founder Crosstalk:** Tester scans never default or fall back to the founder's chat ID.
2. **Onboarding Gate:** Users without target roles are guided through `/setroles` before executing scans.
3. **Correlation Tracking:** Each scan carries a `correlation_id` across execution boundaries.
