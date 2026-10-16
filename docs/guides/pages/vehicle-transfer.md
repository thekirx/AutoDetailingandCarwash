# Transfer a car

**Route:** `/operations/vehicle-transfer`  
**Who:** Super Admin (BossMich), Assistant Super Admin, Branch Admin  
**Not:** Team Lead, crew, sales, marketing, investor, customer

## When to use

The car’s plate should move to a new Hakum account after the owner sells the car. The buyer must already have signed up.

## What moves

- `vehicles.customer_id` → buyer
- Open paint-maintenance schedules (`scheduled` / `notified`) for that plate → buyer’s name, phone, and account

## What does not move

- Past bookings stay on the seller’s history
- A plate the buyer already owns is refused (409)

## Branch Admin rule

A Branch Admin can transfer a car that has at least one visit at a branch they are assigned to, or a car with no visits yet. Super Admin and Assistant Super Admin can transfer any car.

## Shop floor steps

1. Open **Transfer car** in Command.
2. Find the plate → pick the car.
3. Find the buyer by phone → they must have a Hakum account.
4. Transfer. Confirm the toast and, if the car was on paint maintenance, check Bookings › Maintenance.

## Related

- Walk-in with no account: Team Lead tells them to sign up at `/signup`. After signup they see “You have existing history with us.” if prior visits for that phone were attached.
- Cars catalog (`/operations/cars`) is make/model catalog only, not ownership transfer.
