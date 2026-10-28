const { Temporal } = require("@js-temporal/polyfill");

function asInstant(value) {
    return Temporal.Instant.from(value instanceof Date ? value.toISOString() : value);
}

// Gaps move forward by the gap. Overlaps use the earlier start/later end.
function resolveLocal(dateTime, timeZone, boundary) {
    const earlier = dateTime.toZonedDateTime(timeZone, { disambiguation: "earlier" });
    const later = dateTime.toZonedDateTime(timeZone, { disambiguation: "later" });
    if (earlier.toPlainDateTime().equals(dateTime) && later.toPlainDateTime().equals(dateTime)) {
        return boundary === "end" ? later : earlier;
    }
    return dateTime.toZonedDateTime(timeZone, { disambiguation: "compatible" });
}

function findOccurrence(schedule, filters, now) {
    const instant = asInstant(now);
    const zone = schedule.timeZone;
    const windowZone = filters.timeZone || zone;
    const target = filters.window === "date"
        ? Temporal.PlainDate.from(filters.date)
        : instant.toZonedDateTimeISO(windowZone).toPlainDate();
    const windowStart = filters.window === "tonight"
        ? target.toPlainDateTime("17:00").toZonedDateTime(windowZone, { disambiguation: "compatible" }).toInstant()
        : target.toZonedDateTime(windowZone).toInstant();
    const windowEnd = target.add({ days: 1 }).toZonedDateTime(windowZone).toInstant();
    if (Temporal.Instant.compare(windowStart, windowEnd) >= 0) return null;
    if (!["ONCE", "WEEKLY"].includes(schedule.scheduleKind)) throw new RangeError("Unknown schedule kind");
    const effectiveStart = Temporal.PlainDate.from(schedule.startDate);
    const effectiveEnd = schedule.endDate ? Temporal.PlainDate.from(schedule.endDate) : null;
    let next = null;
    // Translate viewer boundaries to venue dates, including overnight starts.
    const first = windowStart.toZonedDateTimeISO(zone).toPlainDate().subtract({ days: 1 });
    const last = windowEnd.toZonedDateTimeISO(zone).toPlainDate();
    for (let day = first; Temporal.PlainDate.compare(day, last) <= 0; day = day.add({ days: 1 })) {
        if (Temporal.PlainDate.compare(day, effectiveStart) < 0) continue;
        if (effectiveEnd && Temporal.PlainDate.compare(day, effectiveEnd) > 0) continue;
        if (schedule.scheduleKind === "ONCE" && !day.equals(effectiveStart)) continue;
        if (schedule.scheduleKind === "WEEKLY" && !(schedule.weekdays ?? []).includes(day.dayOfWeek)) continue;
        const start = resolveLocal(day.toPlainDateTime(schedule.startTime), zone, "start");
        const endDay = schedule.endsNextDay ? day.add({ days: 1 }) : day;
        const end = resolveLocal(endDay.toPlainDateTime(schedule.endTime), zone, "end");
        const startsAt = start.toInstant();
        const endsAt = end.toInstant();
        if (Temporal.Instant.compare(endsAt, startsAt) <= 0) continue;
        if (Temporal.Instant.compare(startsAt, windowEnd) >= 0 || Temporal.Instant.compare(endsAt, windowStart) <= 0) continue;
        if (filters.window !== "date" && Temporal.Instant.compare(endsAt, instant) <= 0) continue;
        if (filters.window === "now" && Temporal.Instant.compare(startsAt, instant) > 0) continue;
        const occurrence = {
            startsAt: startsAt.toString(), endsAt: endsAt.toString(), timeZone: zone,
            localDate: start.toPlainDate().toString(),
            status: Temporal.Instant.compare(endsAt, instant) <= 0 ? "EXPIRED"
                : Temporal.Instant.compare(startsAt, instant) <= 0 ? "ONGOING" : "UPCOMING"
        };
        if (!next || Temporal.Instant.compare(startsAt, Temporal.Instant.from(next.startsAt)) < 0) next = occurrence;
    }
    return next;
}

function evaluateCandidates(rows, filters, now, onInvalid = () => {}) {
    const evaluatedAt = asInstant(now).toString();
    const matches = [];
    for (const row of rows) {
        if (filters.window === "all") {
            let displayOccurrence = null;
            try {
                const localToday = asInstant(now).toZonedDateTimeISO(filters.timeZone || row.timeZone).toPlainDate();
                if (row.scheduleKind === "ONCE") {
                    // ONCE start dates belong to the venue, not the viewer.
                    displayOccurrence = findOccurrence(row, { ...filters, window: "date", date: row.startDate, timeZone: row.timeZone }, now);
                } else {
                    for (let offset = 0; offset < 8 && !displayOccurrence; offset++) {
                        const date = localToday.add({ days: offset }).toString();
                        const candidate = findOccurrence(row, { ...filters, window: "date", date }, now);
                        if (candidate && candidate.status !== "EXPIRED") displayOccurrence = candidate;
                    }
                    if (!displayOccurrence) {
                        for (let offset = 0; offset < 7 && !displayOccurrence; offset++) {
                            const date = Temporal.PlainDate.from(row.startDate).add({ days: offset }).toString();
                            displayOccurrence = findOccurrence(row, { ...filters, window: "date", date, timeZone: row.timeZone }, now);
                        }
                    }
                }
            } catch (error) { if (!(error instanceof RangeError)) throw error; }
            matches.push({ ...row, nextOccurrence: displayOccurrence });
            continue;
        }
        try {
            const nextOccurrence = findOccurrence(row, filters, evaluatedAt);
            if (nextOccurrence) matches.push({ ...row, nextOccurrence });
        } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            // One malformed curated schedule must not break the whole feed.
            onInvalid(row.id, error);
        }
    }
    matches.sort((a, b) => filters.window === "all"
        ? a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
        : Temporal.Instant.compare(a.nextOccurrence.startsAt, b.nextOccurrence.startsAt) || a.id.localeCompare(b.id));
    return {
        items: matches.slice(0, filters.limit),
        count: Math.min(matches.length, filters.limit),
        hasMore: matches.length > filters.limit,
        window: filters.window, evaluatedAt
    };
}

module.exports = { asInstant, resolveLocal, findOccurrence, evaluateCandidates };
