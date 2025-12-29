# P10 - Soft Delete API


#### This API builds on features in P09 Logging API. A few examples of the features that were cleaned up from the previous version are as follows.

### Users
- Normal flows -> deletedAt IS NULL
- Admin flows -> opt-in visibility
- Auth blocks deleted users automatically

### Todos
- User never sees deleted todos
- Admin can choose to see history
- Soft delete preserves audit trail

### Auth
- Deleted users: 
  - cannot login
  - cannot refresh tokens
  - cannot create new todos
- Existing refresh tokens are invalidated

### Audit Logs
- Not foreign-key constrained (correct)
- Still reference deleted entities
- Timeline remains intact


