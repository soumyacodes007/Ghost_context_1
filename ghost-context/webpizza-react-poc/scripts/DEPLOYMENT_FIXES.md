# Deployment Script Fixes

## Issues Fixed

### 1. ✅ RPC URL Logic Error
**Problem**: The RPC URL logic was inverted - when `NETWORK === "testnet"`, it was using mainnet URL.

**Fix**: Changed to use `getFullnodeUrl(NETWORK)` which correctly handles network selection.

```typescript
// Before (WRONG):
const rpcUrl = NETWORK === "testnet"
  ? "https://fullnode.mainnet.sui.io:443"
  : "https://fullnode.testnet.sui.io:443";

// After (CORRECT):
const rpcUrl = getFullnodeUrl(NETWORK);
```

### 2. ✅ Registry Extraction Logic
**Problem**: Registry shared version extraction wasn't handling the shared object structure correctly.

**Fix**: Updated to properly extract `initial_shared_version` from the owner field for shared objects.

```typescript
// Now correctly extracts from owner.Shared.initial_shared_version
if (created.owner && created.owner.Shared) {
  registrySharedVersion = created.owner.Shared.initial_shared_version?.toString() || null;
}
```

### 3. ✅ Module Validation
**Problem**: No check to ensure modules were found before attempting deployment.

**Fix**: Added validation to ensure at least one module file exists.

```typescript
if (moduleFiles.length === 0) {
  console.error("❌ No compiled modules found!");
  process.exit(1);
}
```

### 4. ✅ Package ID Validation
**Problem**: No validation that package ID was successfully extracted.

**Fix**: Added check to ensure package ID exists, with helpful error message showing object changes if extraction fails.

```typescript
if (!packageId) {
  console.error("❌ Failed to extract package ID from deployment");
  console.error("Object changes:", JSON.stringify(result.objectChanges, null, 2));
  process.exit(1);
}
```

### 5. ✅ Enhanced Error Handling
**Problem**: Error messages weren't detailed enough for debugging.

**Fix**: Added comprehensive error logging including error data, cause, and optional full error dump with DEBUG env var.

```typescript
catch (error: any) {
  console.error("\n❌ DEPLOYMENT FAILED");
  console.error("Error:", error.message || error);
  if (error.data) {
    console.error("\nError details:", JSON.stringify(error.data, null, 2));
  }
  if (error.cause) {
    console.error("\nCause:", error.cause);
  }
  if (process.env.DEBUG) {
    console.error("\nFull error:", error);
  }
}
```

## Additional Improvements

- ✅ Created `tsconfig.scripts.json` for proper TypeScript configuration when running scripts
- ✅ Improved path resolution for build directory
- ✅ Better console output formatting
- ✅ More helpful error messages with actionable steps

## Testing

To test the deployment script:

1. **Build the contract first**:
   ```bash
   cd contracts
   sui move build
   ```

2. **Run the deployment**:
   ```bash
   npm run deploy
   ```

3. **For debugging** (if deployment fails):
   ```bash
   DEBUG=1 npm run deploy
   ```

## Files Modified

- `webpizza-react-poc/scripts/deploy.ts` - Fixed all issues
- `webpizza-react-poc/tsconfig.scripts.json` - Created for script compilation

## Notes

- The script uses `tsx` to run TypeScript directly without compilation
- `__dirname` works correctly with tsx for path resolution
- All paths are relative to the project root
- The script automatically extracts both package ID and registry ID from deployment transaction

