// Public surface of the coach feature. Importers outside this folder should
// only reach for `coachRoutes`; everything else (providers, service,
// validation) is implementation detail kept inside `src/coach/` so the whole
// feature can move to its own service later as a folder rename rather than
// an archaeology project.

export { coachRoutes } from './routes';
