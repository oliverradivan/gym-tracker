import sys

new_lines = """    for step in range(1, max(1, periods) + 1):
        # Predict change based on current delta
        if predicted_delta_adj == 0.0:
            # No further change expected.
            next_val = current_projected
        else:
            next_val = current_projected + predicted_delta_adj

        # Ensure forecasted volume is non-negative
        if next_val < 0:
            next_val = 0.0

        # Update the diminishing‑returns factor for the next iteration.
        current_val = abs(next_val)
        diminishing_factor = saturation / (saturation + current_val)
        predicted_delta_adj = predicted_delta * diminishing_factor
        if abs(predicted_delta_adj) < MIN_DELTA_THRESHOLD:
            predicted_delta_adj = 0.0

        next_date = start_date + timedelta(days=step * max(1, interval_days))

        # --- 7. Confidence band ---
        base_conf = get_confidence_band_pct(len(values), step)
        # Widen band if recent delta variability is high relative to the mean trend.
        if abs(mean_recent) > 1e-6:
            var_factor = 1.0 + (std_recent / abs(mean_recent))
        else:
            var_factor = 1.0
        var_factor = min(var_factor, 2.0)  # cap the widening effect
        conf_pct = min(MAX_CONFIDENCE_BAND, base_conf * var_factor)

        lower = max(next_val * (1.0 - conf_pct), 0.0)
        upper = next_val * (1.0 + conf_pct)

        forecast.append(
            {
                "date": next_date.strftime("%Y-%m-%d"),
                "value": round(next_val, 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
            }
        )
        current_projected = next_val
"""

with open('main.py', 'r') as f:
    lines = f.readlines()

# lines are 0-indexed
# line numbers: for step line at index 410 (since line 411)
# return line at index 452 (line 453)
start = 410  # inclusive
end = 452    # exclusive? we want to replace up to line 452 exclusive (line 453 is return)
# Actually we want to replace lines[start:end] where end is index of line 453 (since we want to replace up to line 452)
# line 453 is at index 452 (0-indexed). So we want to replace indices 410 to 451 inclusive? Let's compute:
# line 411 -> index 410
# line 452 -> index 451
# line 453 -> index 452
# We want to replace lines 411 through 452 inclusive => indices 410 to 451 inclusive.
# So slice [410:452] (since end exclusive) gives indices 410-451.
new_block_lines = new_lines.splitlines(keepends=True)
# Ensure newline at end of each line? splitlines(keepends=True) keeps newline.
# Replace
new_lines_list = lines[:start] + new_block_lines + lines[452:]  # from index 452 onward (line 453)
with open('main.py', 'w') as f:
    f.writelines(new_lines_list)
