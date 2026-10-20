# Agreed synthetic sales demo

Source ZIP: restaurant_training_v1_regular_seed_42_no_promotion.zip.
Source CSV: final_test_predictions.csv. Use actual_sales, never ml_prediction.
Spreadsheet rows 327–361 (header = row 1), source dates 25–31 December 2025.
Map to 15–21 October 2026: a 294-day / 42-week shift preserving weekdays.
The checked-in fixture records each original date, row numbers and CSV SHA-256.

Run npm run import:demo-sales from web/ to import only 15–20 October (30 rows).
The transaction skips any date with an existing record, including partial records;
it never overwrites user entries. Repeating it creates no duplicate days or history.
Imported days and snapshots are labelled by sales_provenance, visible in Daily Sales.
This is an app demonstration using prior test-period data, not a new evaluation.
Sold-out status was not recorded by the source; false is a demo assumption.

21 October stays untouched for manual entry:
- Chicken rice: 41
- Fried kuey teow with egg: 30
- Nasi lemak with egg: 50
- Kopi O ais: 54
- Iced lemon tea: 36

These manual values are synthetic too; label that entry synthetic when entering it.
After seven complete dates, the intended forecast date is 22 October 2026.
These dates are fixed for this agreed scenario, not automatically moved on each startup.
No inventory deductions, model calls or forecasts occur during this import.
