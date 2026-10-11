// Lets `node --test` load the app's TypeScript the way Metro does: a relative
// import without an extension ('./syncPlan') resolves to the .ts file. Test
// files only; the app itself is bundled by Metro. Used by the "test" script.
import { register } from 'node:module';

register('./tsResolveHooks.mjs', import.meta.url);
