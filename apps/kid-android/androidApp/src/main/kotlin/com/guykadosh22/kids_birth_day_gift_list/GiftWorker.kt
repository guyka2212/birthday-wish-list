package com.guykadosh22.kids_birth_day_gift_list

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Polls the kid's activity feed every ~15 minutes and shows a local notification when a gift was bought.
 * No Firebase needed. The notification never says who bought what, so it stays a surprise.
 */
class GiftWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as KidApp
        if (!app.repo.api.isLoggedIn) return Result.success()
        val seen = app.prefs.getLong(KEY_SEEN, 0)
        val items = runCatching { app.repo.activitySince(seen) }.getOrElse { return Result.retry() }
        val gifts = items.filter { it.kind == "gift_bought" && it.createdAt > seen }
        if (gifts.isNotEmpty()) {
            notify(applicationContext, gifts.size)
            app.prefs.edit().putLong(KEY_SEEN, gifts.maxOf { it.createdAt }).apply()
        }
        return Result.success()
    }

    companion object {
        const val KEY_SEEN = "activity_seen_at"
        private const val CHANNEL = "gifts"

        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<GiftWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("gift-poll", ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun notify(ctx: Context, count: Int) {
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) return
            val nm = ctx.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(NotificationChannel(CHANNEL, "מתנות", NotificationManager.IMPORTANCE_DEFAULT))
            }
            val open = PendingIntent.getActivity(
                ctx, 0,
                Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val n = NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.star_on)
                .setContentTitle("מישהו קנה לך מתנה! 🎁")
                .setContentText(if (count == 1) "אחת המתנות ברשימה שלך נקנתה 🤫" else "$count מתנות ברשימה שלך נקנו 🤫")
                .setAutoCancel(true)
                .setContentIntent(open)
                .build()
            NotificationManagerCompat.from(ctx).notify(1001, n)
        }
    }
}
