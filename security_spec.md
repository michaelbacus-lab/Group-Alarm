# Security Specification for Group Alarm

## 1. Data Invariants
1. Users can only read and modify their own user profile `/users/{userId}`.
2. Group creation requires the creator to set `ownerId` strictly matching `request.auth.uid`.
3. Membership in `/groups/{groupId}/members/{userId}` requires either the owner adding members, or an authenticated user joining themselves (`userId == request.auth.uid`).
4. Schedules under `/groups/{groupId}/schedules/{scheduleId}` can only be created, modified, or deleted by group members.
5. Acknowledgements under `/groups/{groupId}/schedules/{scheduleId}/acknowledgements/{userId}` can only be written by the user themselves (`userId == request.auth.uid`), provided they are members of the group.
6. Identity spoofing is strictly prohibited: document IDs and UID fields must match `request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. Unauthorized User Profile Write: User A attempts to write to `/users/userB`.
2. Spoofed Group Creation: User sets `ownerId: "victimUid"` during group creation.
3. Ghost Fields in Group: Group creation payload includes arbitrary unallowed keys.
4. Non-member Schedule Access: User who is not a member tries to read or create a schedule in `/groups/{groupId}`.
5. Impersonated Member Join: User A tries to create `/groups/{groupId}/members/userB`.
6. Non-owner Group Deletion: Normal member tries to delete the group.
7. Unchecked Acknowledgement Spoof: User A writes RSVP for user B.
8. Malicious String Overflow: Title with >500 characters injected into schedule.
9. Invalid Path Injection: Document ID with malicious characters injected.
10. Unauthenticated Access: Unauthenticated client requests any group or schedule data.
11. Privilege Escalation: Non-owner member attempts to elevate role to owner.
12. Terminal State Tampering: Schedule update altering immutable fields like `groupId` or `creatorId`.
