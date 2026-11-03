# Rocket ACTION — investor demo

A synthetic-data analytics prototype for institutional real-estate operators: it mines the pricing/renovation thresholds an operator's own written policies already enforce, measures what each rule is actually worth with causal evidence (regression discontinuity + registered pilots), and keeps a calibration ledger of its own predictions.

**Live demo:** https://ajaxdude.github.io/rocket-action-demo/

Everything you see is generated: a 2,400-home synthetic portfolio with a hidden answer key that the analysis engines never read, so every accuracy claim is graded against known truth. No real customer data, no credentials, no network calls from the app.

## Run locally

Just open `index.html` in a browser (Chrome or Edge recommended), or serve the folder:

```bash
python3 -m http.server 5199   # then open http://127.0.0.1:5199
```

## Tour order

Data health → Insights map → an insight → Design lab → Ledger → a readout (tabs: E4, E7, E10, E3) → Evidence loop → Total opportunity. About 12 minutes.
