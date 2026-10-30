const { z } = require("zod");

function isValidTimeZone(value) {
    const hasZoneName =
        value === "UTC" ||
        /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value);

    if (!hasZoneName) {
        return false;
    }

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

const optionalText = z.string()
    .trim()
    .max(2000)
    .nullable()
    .default(null);

const optionalUrl = z.string()
    .trim()
    .max(2048)
    .refine(isHttpUrl, {
        message: "Must be a valid HTTP or HTTPS URL."
    })
    .nullable()
    .default(null);

const localTime = z.string()
    .regex(
        /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
        "Use HH:mm or HH:mm:ss."
    )
    .transform(value => value.length === 5 ? `${value}:00` : value);

const scheduleSchema = z.preprocess(value => {
    if (value && typeof value === "object" && value.allDay === true) return { ...value, startTime: "00:00", endTime: "23:59", endsNextDay: false };
    return value;
}, z.strictObject({
    kind: z.enum(["ONCE", "WEEKLY"]),
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable().default(null),
    startTime: localTime,
    endTime: localTime,
    endsNextDay: z.boolean().default(false),
    timeZone: z.string()
        .trim()
        .min(1)
        .max(100)
        .refine(isValidTimeZone, {
            message: "Use a valid named time zone, such as America/Denver."
        }),
    allDay: z.boolean().default(false),
    weekdays: z.array(z.number().int().min(1).max(7))
        .max(7)
        .refine(days => new Set(days).size === days.length, {
            message: "Weekdays must not contain duplicates."
        })
        .default([])
})
    .refine(
        schedule =>
            schedule.endDate === null ||
            schedule.endDate >= schedule.startDate,
        {
            message: "End date must be on or after start date.",
            path: ["endDate"]
        }
    )
    .refine(
        schedule =>
            schedule.kind !== "ONCE" ||
            schedule.endDate === schedule.startDate,
        {
            message: "A one-time schedule needs matching start and end dates.",
            path: ["endDate"]
        }
    )
    .refine(
        schedule => schedule.kind === "WEEKLY"
            ? schedule.weekdays.length > 0
            : schedule.weekdays.length === 0,
        {
            message: "Weekly schedules need weekdays; one-time schedules must have none.",
            path: ["weekdays"]
        }
    )
    .refine(
        schedule => schedule.endsNextDay
            ? schedule.endTime <= schedule.startTime
            : schedule.endTime > schedule.startTime,
        {
            message: "Start/end times must agree with endsNextDay.",
            path: ["endTime"]
        }
    ));

const createExperienceSchema = z.strictObject({
    businessId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    type: z.enum(["OFFER", "EVENT", "ACTIVITY", "SPECIAL"]),
    priceAmount: z.string()
        .regex(
            /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/,
            "Use a nonnegative decimal string with up to two decimal places."
        )
        .nullable()
        .default(null),
    currency: z.string()
        .regex(/^[A-Z]{3}$/, "Use a three-letter uppercase currency code.")
        .nullable()
        .default(null),
    offer: optionalText,
    requirements: optionalText,
    imageUrl: optionalUrl,
    sourceUrl: optionalUrl,
    categoryIds: z.array(z.uuid())
        .min(1)
        .max(20)
        .refine(ids => new Set(ids).size === ids.length, {
            message: "Category IDs must not contain duplicates."
        }),
    schedule: scheduleSchema
}).refine(
    experience =>
        experience.priceAmount === null ||
        experience.currency !== null,
    {
        message: "Currency is required when a price is provided.",
        path: ["currency"]
    }
);
const updateExperienceSchema = z.strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10000).optional(),
    offer: z.string().trim().max(2000).nullable().optional(),
    requirements: z.string().trim().max(2000).nullable().optional()
}).refine(
    data => Object.values(data).some(value => value !== undefined),
    {
        message: "Provide at least one field to update."
    }
);
module.exports = {
    createExperienceSchema,
    updateExperienceSchema
};