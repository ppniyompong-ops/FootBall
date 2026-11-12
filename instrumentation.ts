export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') {
    return;
  }

  const { startKeepWarm } = await import('./lib/keep-warm');
  startKeepWarm();
}
