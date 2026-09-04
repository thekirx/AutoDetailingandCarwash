# POS

**Route:** `/operations/pos`  
**Roles:** BA primary; SA/ASA/Ops Lead  
**Shell:** Command

## Purpose
Checkout, cart, shift close handoff.

## Layout
```
Tablet+: [Catalog | Cart]
Phone: [Catalog] sticky cart bar → Sheet cart
[EOS wizard step rail]
```

## Components
StatCard, DataTable, ResponsiveSheet, ConfirmDialog, sticky pay bar.

## Task flow
Scan/select → cart → pay → receipt → optional shift close.
