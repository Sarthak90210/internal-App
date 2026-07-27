# Versioning and Runtime Management Rules for AI

This document outlines the rules for an AI agent to manage the application's runtimes and versions. When modifying the application and bumping versions, strictly adhere to the following scheme:

## Definitions
- **Version**: Follows the format `Vx.y` (e.g., `V2.0`, `V2.1`). This corresponds to the `version` field in files like `app.json` and `package.json` (often written as `x.y.0` or `x.y`).
- **Runtime**: Corresponds to the `x` component (the major version integer). This represents the `runtimeVersion` field in `app.json`.

## Versioning Rules

### 1. Native Changes (Runtime Bump)
- **Condition**: If there is **any native change** to the app (e.g., adding/updating a native dependency, modifying native Android/iOS project files, or upgrading the Expo SDK).
- **Action**: You must **bump the runtime** and the version. Increment `x` by 1 and reset `y` to `0`.
- **Example**:
  - Current: Runtime `2`, Version `V2.1`
  - New: Runtime `3`, Version `V3.0`

### 2. Non-Native Changes (Minor Version Bump)
- **Condition**: If there are **no native changes**, and the updates consist only of smaller changes (e.g., JavaScript/TypeScript logic, UI updates, styles, or assets).
- **Action**: The **runtime remains the same**, but you must **bump the version** in the `y` component by incrementing it by 1.
- **Example**:
  - Current: Runtime `2`, Version `V2.0`
  - New: Runtime `2`, Version `V2.1`
