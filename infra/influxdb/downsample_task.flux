// Hourly downsampling task: aggregates raw telemetry into hourly buckets
// Runs every hour, processes the previous hour's data

option task = {
    name: "downsample_telemetry_hourly",
    every: 1h,
    offset: 5m,  // Run 5 min after the hour to ensure data is complete
}

from(bucket: "telemetry")
    |> range(start: -2h, stop: -1h)
    |> filter(fn: (r) => r._measurement == "bess_telemetry")
    |> aggregateWindow(
        every: 1h,
        fn: (tables=<-, column) => tables
            |> reduce(
                identity: {
                    soc_avg: 0.0, soc_min: 100.0, soc_max: 0.0,
                    power_avg: 0.0, power_max: 0.0,
                    temp_avg: 0.0, temp_max: 0.0,
                    count: 0,
                },
                fn: (r, accumulator) => ({
                    soc_avg: accumulator.soc_avg + r.soc,
                    soc_min: if r.soc < accumulator.soc_min then r.soc else accumulator.soc_min,
                    soc_max: if r.soc > accumulator.soc_max then r.soc else accumulator.soc_max,
                    power_avg: accumulator.power_avg + r.power_kw,
                    power_max: if r.power_kw > accumulator.power_max then r.power_kw else accumulator.power_max,
                    temp_avg: accumulator.temp_avg + r.temp_avg,
                    temp_max: if r.temp_max > accumulator.temp_max then r.temp_max else accumulator.temp_max,
                    count: accumulator.count + 1,
                }),
            )
    )
    |> to(
        bucket: "telemetry_aggregated",
        org: "lifo4",
        measurementColumn: "_measurement",
        tagColumns: ["system_id", "organization_id"],
    )
