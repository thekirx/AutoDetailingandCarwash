# Verification — ASA deep audit

## Commands (this session)

```bash
node --test tests/asaScope.test.js tests/permissions.test.js tests/queueLogic.test.js tests/posBranchScope.test.js tests/crmPart7.test.js tests/part8.test.js
npm run build
```

## Results

| Check | Exit | Evidence |
|-------|------|----------|
| Focused tests | **0** | 46 pass / 0 fail |
| `npm run build` | **0** | vite + PWA ok |
| Migration | applied | `asa_grant_queue_all_enforcement` |

## Live DB

- `asa_has_grant(text)` deployed  
- `sync_queue_assignments` rejects ASA without `queue_all`  
