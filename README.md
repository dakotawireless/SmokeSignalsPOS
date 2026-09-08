# SmokeSignalsPOS

Initial working Smoke Signals POS prototype built from the current POS product export.

## Imported catalog
- 1967 products
- product name
- category
- supplier
- cost
- sale price
- description
- barcode list
- initial inventory count set to 0 for rollout counting

## Implemented in this build
- Quick Picks home-screen section, manually curated from Inventory
- maximum 12 Quick Picks
- real product categories from the import
- barcode scanning at the register
- multiple barcodes per product
- add/edit product
- scan-to-add barcode builder (no commas required)
- duplicate barcode protection
- initial inventory count for new products
- Add Received Inventory
- Adjust Inventory Count with reason
- inventory movement history
- line-item price override / percent discount / dollar discount + reason
- transaction Discount menu:
  - Employee Discount 25%
  - Miscellaneous Discount Percentage
  - Miscellaneous Discount Dollar Amount
- customer creation and age-verified indicator
- Cash, Card, and Split Payment prototype flows

## Run locally
Open `index.html` in a browser.

The prototype stores edits in browser localStorage, so changes persist on that computer/browser while we continue development.


## Current product import
The original 216-product test import was discarded and replaced with Products.xlsx containing 1967 product records.
