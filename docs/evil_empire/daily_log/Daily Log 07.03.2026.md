---
title: Daily Log 07.03.2026
type: note
permalink: daily-log/daily-log-07.03.2026
tags:
- daily-log
- navigation
- ui
- loading
---

# Daily Log 07.03.2026

## Add RMs tab to NavigationBar
Added a new "RMs" tab to the bottom navigation bar linking to `/repetition-maximums`. Uses `MaterialCommunityIcons` `podium-gold` icon, with support for mixed icon families via an `iconFamily` property on `NavigationItem`.

## Add NavigationBar to repetition-maximums page
Added `NavigationBar` component to the RMs page so the bottom tab bar is visible. Removed the back button header since it's now a top-level tab, replaced with a simple title. Cleaned up unused `router` import.

## Show NavigationBar during loading and use spinner on history page
Fixed history page loading state to include `NavigationBar` so tabs remain visible while data loads. Replaced "Loading..." text with a centered `ActivityIndicator` spinner.