# Workflow Specification

---

## 1. Document Control

| Version | Date | Author | Description |
|--------|------|--------|-------------|
| v1.0 | {{date}} | {{author}} | Initial version |

---

## 2. Flow Overview

### 2.1 Flow Summary

{{Describe what this workflow does}}

### 2.2 Objective

{{What outcome this flow ensures}}

---

## 3. Actors

- **ACTOR-01:** {{Primary actor}}
- **ACTOR-02:** {{Supporting actor}}

---

## 4. Preconditions

- {{System state before start}}
- {{Required data}}

---

## 5. Main Flow

1. **Step 1:** {{Trigger}}
2. **Step 2:** {{System processing}}
3. **Step 3:** {{Decision (if any)}}
4. **Step 4:** {{User-visible outcome}}

---

## 6. Decision Points

- **DEC-01:** {{Condition → outcome}}
- **DEC-02:** {{Condition → outcome}}

---

## 7. Edge Cases

- **EDGE-01:** {{Failure scenario}}
- **EDGE-02:** {{Timeout / missing data}}
- **EDGE-03:** {{Invalid input}}

---

## 8. Postconditions

- {{Final system state}}
- {{User-visible result}}

---

## 9. Diagram Reference

| Diagram | File |
|--------|------|
| Main Flow | ./{{flow-name}}.mmd |

---

## 10. Notes

- Diagram must be created in Mermaid (.mmd)
- No diagram should be embedded inside markdown
- Logic must match PRD requirements
