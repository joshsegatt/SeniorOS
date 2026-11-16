# 2. Hire is charged per calendar day

Date: 2025-06-18

## Context

The first version of the booking site charged per night, like a hotel: pickup on Monday and return on Tuesday was
one day. The yard does not work that way. A machine collected on Monday morning cannot be hired to anyone else that
day, and a machine brought back on Tuesday afternoon has to be checked and cleaned before it goes out again, so it is
lost for Tuesday too. Our signed hire terms (v3, section 4.1) already said "the day of collection and the day of
return each count as a full hire day".

## Decision

A hire runs from its pickup day to its return day, **both included**. Pickup and return on the same day is one hire
day; Monday to Tuesday is two. Everything that counts hire days (the quote, the damage waiver, the weekly rate,
availability) uses that count. Late fees are different: they count the days *after* the agreed return day, so a
machine returned on its return day owes nothing.

## Consequences

Customers who compare our quotes with hotel-style competitors sometimes ask about the extra day; support answers
with section 4.1 of the terms.
