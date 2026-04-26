# Daily Log 26.04.2026

## fix(web): un-nest program assign/edit so detail page can navigate to them
Renamed the assign/edit routes to flat siblings (`$id_.assign.tsx`, `$id_.edit.tsx`) so they mount independently of the detail route, which had no Outlet — the click was navigating but the child had nowhere to render. Also wired virtual program sessions onto the day view with a materialize action and shortened the assign flow when no 1RMs need filling.
