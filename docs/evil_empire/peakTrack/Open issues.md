## Add some analytics tool

https://mixpanel.com/home/


## Onboarding?
## GDPR?

## Could the flow to create workout and exercises be simpler?

Directly adding exercises that will be part of todays workout? 

![[Screenshot 2026-03-12 at 8.50.21.png]]

Instead directly adding exercises here! Exercises default
shoDD.MM.YYYY.workout
![[Pasted image 20260312085255.png]]

## Circuit workouts

- [ ] currently JSONB, should it be own table e.g. circuit_exercises?


e.g ENOM 5min: 3 x 20cal erg, 20 T2B, 20 32kg KB swings


Circuit data:


| type | time | unit | rounds | circuit_exercices |
| ---- | ---- | ---- | ------ | ----------------- |
| enom | 5    | min  | 3      | #12345            |


circuit_exercises:

| id     | name      | reps | unit | weight |
| ------ | --------- | ---- | ---- | ------ |
| #12345 | erg       | 20   | cal  | NULL   |
| #12345 | T2B       | 20   | NULL | NULL   |
| #12345 | KB swings | 20   | NULL | 32(kg) |
 - kilogram unit should not be at this table level, it's at user settings level

- [x] Implement workout rating
![[Screenshot 2026-03-10 at 10.02.38.png]]
 



