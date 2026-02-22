// F12: Hourly downsampling task — corrected Flux syntax.
// The previous version used aggregateWindow with reduce inside fn, which is
// invalid in Flux. aggregateWindow's fn parameter accepts only built-in
// aggregate functions (mean, sum, min, max, etc.), not custom reduce blocks.
// Fix: use separate aggregateWindow passes per statistic, then union.

option task = {
    name: "downsample_telemetry_hourly",
    every: 1h,
    offset: 5m,  // Run 5 min after the hour to ensure all data is written
}

data = from(bucket: "telemetry")
    |> range(start: -2h, stop: -1h)
    |> filter(fn: (r) => r._measurement == "bess_telemetry")

// Mean values for all key fields
meanData = data
    |> filter(fn: (r) =>
        r._field == "soc" or
        r._field == "power_kw" or
        r._field == "temp_avg" or
        r._field == "temp_min" or
        r._field == "temp_max"
    )
    |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
    |> map(fn: (r) => ({r with _field: r._field + "_mean"}))

// SOC minimum (worst-case state of charge in the hour)
socMin = data
    |> filter(fn: (r) => r._field == "soc")
    |> aggregateWindow(every: 1h, fn: min, createEmpty: false)
    |> map(fn: (r) => ({r with _field: "soc_min"}))

// SOC maximum (best state of charge in the hour)
socMax = data
    |> filter(fn: (r) => r._field == "soc")
    |> aggregateWindow(every: 1h, fn: max, createEmpty: false)
    |> map(fn: (r) => ({r with _field: "soc_max"}))

// Power peak (maximum absolute power demand in the hour)
powerMax = data
    |> filter(fn: (r) => r._field == "power_kw")
    |> map(fn: (r) => ({r with _value: math.abs(x: r._value)}))
    |> aggregateWindow(every: 1h, fn: max, createEmpty: false)
    |> map(fn: (r) => ({r with _field: "power_kw_max"}))

// Temperature peak (maximum cell temperature in the hour — thermal safety)
tempPeak = data
    |> filter(fn: (r) => r._field == "temp_max")
    |> aggregateWindow(every: 1h, fn: max, createEmpty: false)
    |> map(fn: (r) => ({r with _field: "temp_max_peak"}))

union(tables: [meanData, socMin, socMax, powerMax, tempPeak])
    |> to(
        bucket: "telemetry_aggregated",
        org: "lifo4",
        measurementColumn: "_measurement",
        tagColumns: ["system_id", "organization_id"],
    )
