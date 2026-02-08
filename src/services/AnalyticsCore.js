const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { format, subDays, differenceInDays } = require('date-fns');

/**
 * AnalyticsCore
 * A reusable, event-driven engine for tracking habits and performance.
 */
class AnalyticsCore {
    /**
     * Logs an activity event for a user.
     */
    static async logEvent(userId, type, payload = {}) {
        const {
            value = 1,
            unit = null,
            metadata = {},
            workoutId = null,
            exerciseId = null,
            bodyPart = null,
            durationSeconds = null,
            calories = null,
            weight = null,
            reps = null,
            sets = null,
            ...otherFields // Capture any other fields (e.g., exerciseName, isPR)
        } = payload;

        // Merge explicit metadata with other loose fields
        const finalMetadata = { ...metadata, ...otherFields };

        return await prisma.activityEvent.create({
            data: {
                userId,
                type,
                value: value !== null ? parseFloat(value) : null,
                unit,
                metadata: finalMetadata,
                workoutId,
                exerciseId,
                bodyPart,
                durationSeconds,
                calories,
                weight: weight !== null ? parseFloat(weight) : null,
                reps: reps !== null ? parseInt(reps) : null,
                sets: sets !== null ? parseInt(sets) : null
            }
        });
    }

    /**
     * Calculates the current streak for a specific event type.
     */
    static async calculateStreak(userId, eventType, windowDays = 60) {
        const startDate = subDays(new Date(), windowDays);

        const events = await prisma.activityEvent.findMany({
            where: {
                userId,
                type: eventType,
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        if (events.length === 0) return 0;

        // Unique dates (YYYY-MM-DD)
        const eventDates = [...new Set(events.map(e => format(e.createdAt, 'yyyy-MM-dd')))];
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        // Check if the streak is active (today or yesterday)
        if (eventDates[0] !== today && eventDates[0] !== yesterday) {
            return 0;
        }

        let streak = 1;
        for (let i = 0; i < eventDates.length - 1; i++) {
            const d1 = new Date(eventDates[i]);
            const d2 = new Date(eventDates[i + 1]);
            const diff = differenceInDays(d1, d2);

            if (diff === 1) {
                streak++;
            } else {
                break;
            }
        }

        // Update summary cache
        await this.updateSummary(userId, `${eventType}_streak`, streak);

        return streak;
    }

    /**
     * Calculates total volume (rolled up value) for an event over time.
     */
    static async calculateVolume(userId, eventType, days = 7) {
        const startDate = subDays(new Date(), days);
        const result = await prisma.activityEvent.aggregate({
            where: {
                userId,
                type: eventType,
                createdAt: { gte: startDate }
            },
            _sum: { value: true }
        });

        const volume = result._sum.value || 0;
        await this.updateSummary(userId, `${eventType}_volume_${days}d`, volume);

        return volume;
    }

    /**
     * Updates the AnalyticsSummary table as a read-cache.
     */
    static async updateSummary(userId, metricKey, value, metadata = {}) {
        return await prisma.analyticsSummary.upsert({
            where: { userId_metricKey: { userId, metricKey } },
            update: { value, metadata, lastUpdated: new Date() },
            create: { userId, metricKey, value, metadata }
        });
    }

    /**
     * Fetches pre-calculated summaries.
     */
    static async getSummaries(userId, keys) {
        return await prisma.analyticsSummary.findMany({
            where: {
                userId,
                metricKey: { in: keys }
            }
        });
    }
}

module.exports = AnalyticsCore;
