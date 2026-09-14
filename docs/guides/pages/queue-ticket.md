# Queue ticket

**Routes:** `/operations/queue/new`, `/operations/queue/:id`  
**Shell:** Floor / Command

## Purpose
Create or edit one ticket (plate, service, notes, status).

## Layout
Form-first; sticky Save above safe-area.

## Vehicle
Brand + model come from Super Admin Cars (`vehicle_catalog`). An exact catalog hit auto-selects car size (Small–XL) and reprices selected services/packages. Team Lead can override size on the ticket; plate recall can still fill the last visit’s size first.

## Components
Input, VehicleMakeModelFields, ServiceKindPicker, Select, ConfirmDialog.
