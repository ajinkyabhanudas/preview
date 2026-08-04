# Canopy

## The problem

The science team cannot query the monitoring database without an engineer,
so every question costs a person a day and most questions never get asked.

## The hardest decision

Read-only SQL generation over a fine-tuned model. Fine-tuning would have
handled schema quirks better, but it made every answer unauditable — and an
unauditable answer to a conservation question is worse than no answer.

## What I got wrong

The first failure taxonomy was derived from imagined failures rather than
real outputs. Three of the six categories never occurred once in 130 cases.
