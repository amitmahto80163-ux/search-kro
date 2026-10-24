# Search Kro — Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `/users/{userId}` belongs exclusively to the authenticated Firebase user whose `request.auth.uid == userId` and `data.uid == userId`.
2. **Verified Email Requirement**: Write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **No Blanket Reads or List Queries**: No user may list `/users` or read another user's `/users/{userId}` document. Only `get` by the verified owner (`isOwner(userId)`) is permitted.
4. **Strict Key & Volumetric Validation**: `UserProfile` documents must contain only the exact 10 allowed keys (`uid`, `displayName`, `homeState`, `category`, `annualBudgetInr`, `class12Percent`, `compareIds`, `checklistCompletedIds`, `createdAt`, `updatedAt`), with bounded string/list lengths and server timestamps (`request.time`).
5. **Immutable Identity & Creation Timestamp**: During `update`, `uid` and `createdAt` must remain strictly unchanged (`incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`).

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/users/user_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'user_1', token: { email_verified: false } }`, creating `/users/user_1` -> `PERMISSION_DENIED`.
3. **Cross-User Read (PII/Profile Leak)**: `auth = { uid: 'user_2', token: { email_verified: true } }`, reading `/users/user_1` -> `PERMISSION_DENIED`.
4. **UID Spoofing in Payload**: `auth = { uid: 'user_1' }`, creating `/users/user_1` with `{ uid: 'user_2', ... }` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Creating or updating `/users/user_1` with `{ ..., isAdmin: true }` -> `PERMISSION_DENIED`.
6. **Path ID Poisoning**: Creating `/users/invalid$id!@#` -> `PERMISSION_DENIED`.
7. **Oversized String DoS**: Creating `/users/user_1` with `displayName` of 5,000 characters -> `PERMISSION_DENIED`.
8. **Unbounded Array DoS**: Updating `/users/user_1` with `compareIds` containing 50 items (max is 4) -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating `/users/user_1` with a past/future `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: Updating `/users/user_1` where `createdAt` or `uid` is modified -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Updating `annualBudgetInr` with a string `"100000"` instead of a number -> `PERMISSION_DENIED`.
12. **Collection Scraping (`list`)**: Executing a collection `list` query on `/users` -> `PERMISSION_DENIED`.
