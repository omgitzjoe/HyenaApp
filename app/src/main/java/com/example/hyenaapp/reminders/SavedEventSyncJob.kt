package com.example.hyenaapp.reminders

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import com.example.hyenaapp.data.repository.SavedEventSync
import kotlinx.coroutines.*

class SavedEventSyncJob : JobService() {
    private var task: Job? = null
    override fun onStartJob(params: JobParameters): Boolean {
        task = CoroutineScope(Dispatchers.IO).launch {
            try { SavedEventSync.refresh(applicationContext) }
            catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) { /* The next periodic check can retry. */ }
            finally { if (isActive) jobFinished(params, false) }
        }
        return true
    }
    override fun onStopJob(params: JobParameters): Boolean { task?.cancel(); return true }
    override fun onDestroy() { task?.cancel(); super.onDestroy() }
    companion object {
        fun ensureScheduled(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java)
            if (scheduler.getPendingJob(9207) == null) scheduler.schedule(JobInfo.Builder(9207, ComponentName(context, SavedEventSyncJob::class.java))
                .setPeriodic(maxOf(15 * 60_000L, JobInfo.getMinPeriodMillis()))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build())
        }
    }
}
