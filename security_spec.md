# Security Specification: Minecraft Mod Translator Firestore Security

This security specification details the Data Invariants, the "Dirty Dozen" Threat Model Payloads, and the verification rules required to secure user translator data and glossaries under a Zero-Trust strategy.

## 1. Data Invariants
* **Identity Isolation**: A user can only access, create, or update data inside `/users/{userId}` where `userId == request.auth.uid`. No user can read or write other users' tasks or settings.
* **Email Verification**: Only users authenticated with a verified email (`request.auth.token.email_verified == true`) are permitted write access to tasks and custom glossaries.
* **Task State Progression**: Task records can only modify state fields (`progress`, `status`, `logs`, `errors`, `stats`, `downloadUrl`) during updates; the core identity fields (`id`, `userId`, `originalName`, `translatedName`, `createdAt`) are completely immutable once created.
* **Size & Volumetric Constraints**: String properties such as file names and URLs are limited to 255 and 500 characters respectively, preventing database resource exhaustion attacks.

---

## 2. The "Dirty Dozen" Threat Model Payloads
The following payloads must be strictly rejected (`PERMISSION_DENIED`) by the security rules:

1. **Identity Spoofing on Create**: Attempting to create a user profile under `/users/alice` with `uid` set to "bob".
2. **Anonymous Write Exploit**: A user without an verified email attempting to create a translation task.
3. **Cross-User Directory Enumeration**: Bob trying to list Alice's tasks in `/users/alice/tasks`.
4. **Task Hijacking / Re-assignment**: Bob attempting to update Alice's task `/users/alice/tasks/task123` to change `userId` to Bob's UID.
5. **Core Field Mutation**: Bob attempting to update a task to change the `originalName` of the mod.
6. **Out-of-Bounds Progress Injection**: Injecting a `progress` value of `200` or `-50`.
7. **Resource Poisoning via Oversized Filename**: Creating a task where `originalName` has a size of 10,000 characters.
8. **Malicious ID Poisoning**: Creating a task with a document ID containing special characters (e.g. `../../bad_id`) or massive length.
9. **Glossary Privilege Escalation**: Alice trying to write into Bob's `/users/bob/settings/glossary`.
10. **Array Injection (Unbounded List Attack)**: Injecting high volume nested objects in the `errors` list.
11. **Malicious Schema Injection**: Adding a phantom property `isAdmin: true` inside a user profile or a task.
12. **Bypassing the Default Deny**: Attempting to read/write random root level collections (e.g., `/global_config/123`).

---

## 3. Security Rules Verification
The `firestore.rules` file contains strict path validation, helper functions, and type guard functions (`isValidUser`, `isValidTask`, and `isValidGlossary`) which block all of the above vulnerability vectors.
