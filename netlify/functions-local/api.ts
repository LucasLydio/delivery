/** Local Netlify entrypoint. Keeping one function avoids bundling SSE and scheduled jobs for daily work. */
export { handler } from '../functions/api';
