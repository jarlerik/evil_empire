---
title: TestFlight Internal Testing Setup
type: note
permalink: evil-empire/marketing/test-flight-internal-testing-setup
tags:
- testflight
- distribution
- ios
- testing
- eas
---

# TestFlight Internal Testing Setup

## Overview
Using Internal Testing for distributing to 2-3 early testers from the Olympic weightlifting group. No Apple review needed — available immediately after upload.

## Your Steps
1. Build: `eas build --platform ios --profile production`
2. Submit: `eas submit --platform ios`
3. In App Store Connect → your app → **TestFlight** tab
4. Add testers under **Internal Testing** using their Apple ID emails
5. Up to 100 internal testers allowed

## What Testers Need
- An iPhone
- Install the **TestFlight** app (free from App Store)
- Accept the email invite
- Tap "Install" in TestFlight

## Ongoing
- Each new build you push automatically appears in their TestFlight — they just tap "Update"
- No review wait for internal builds

## If the Group Grows
Switch to **External Testing** (up to 10,000 testers, public link option) — but first build requires Apple beta review (24-48 hours).
