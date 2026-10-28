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
    const target = filters.window === "date"
        ? Temporal.PlainDate.from(filters.date)
        : instant.toZonedDateTimeISO(zone).toPlainDate();
    const windowStart = filters.window === "tonight"
        ? target.toPlainDateTime("17:00").toZonedDateTime(zone, { disambiguation: "compatible" }).toInstant()
        : target.toZonedDateTime(zone).toInstant();
    const windowEnd = target.add({ days: 1 }).toZonedDateTime(zone).toInstant();
    if (Temporal.Instant.compare(windowStart, windowEnd) >= 0) return null;
    if (!["ONCE", "WEEKLY"].includes(schedule.scheduleKind)) throw new RangeError("Unknown schedule kind");
    const effectiveStart = Temporal.PlainDate.from(schedule.startDate);
    const effectiveEnd = schedule.endDate ? Temporal.PlainDate.from(schedule.endDate) : null;
    let next = null;
    // Include yesterday's start to find an overnight event still running today.
    for (let offset = -1; offset <= 0; offset++) {
        const day = target.add({ days: offset });
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
            matches.push({ ...row, nextOccurrence: null });
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
