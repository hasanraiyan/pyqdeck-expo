export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && relative && !/\.[a-z]+$/i.test(specifier)) {
      for (const ext of ['.ts', '/index.ts']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}
