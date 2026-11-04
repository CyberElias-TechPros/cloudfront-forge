package com.creatorloop.app.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStoreFile
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.room.Room
import com.creatorloop.app.BuildConfig
import com.creatorloop.app.data.CacheDao
import com.creatorloop.app.data.CacheDatabase
import com.creatorloop.app.data.SessionManager
import com.creatorloop.core.networkapi.generated.LoopApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton fun json(): Json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true; encodeDefaults = true }
    @Provides @Singleton fun preferences(@ApplicationContext context: Context): DataStore<Preferences> =
        PreferenceDataStoreFactory.create(scope = CoroutineScope(SupervisorJob() + Dispatchers.IO), produceFile = { context.preferencesDataStoreFile("loop_settings") })
    @Provides @Singleton fun database(@ApplicationContext context: Context): CacheDatabase =
        Room.databaseBuilder(context, CacheDatabase::class.java, "loop_cache.db").fallbackToDestructiveMigration().build()
    @Provides @Singleton fun cacheDao(db: CacheDatabase): CacheDao = db.cacheDao()

    @Provides @Singleton fun http(session: SessionManager): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
            redactHeader("Authorization")
        }
        return OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).writeTimeout(30, TimeUnit.SECONDS).callTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(false)
            .addInterceptor { chain ->
                val original = chain.request()
                if (!BuildConfig.ALLOW_CLEARTEXT && !original.url.isHttps) throw IOException("Cleartext API traffic is disabled in this build")
                val builder = original.newBuilder().header("Accept", "application/json")
                    .header("X-Client-Platform", "android").header("X-Client-Version", BuildConfig.VERSION_NAME)
                    .header("X-Request-Id", UUID.randomUUID().toString())
                session.token()?.let { builder.header("Authorization", "Bearer $it") }
                chain.proceed(builder.build())
            }
            .addInterceptor(AuthRetryInterceptor(session))
            .addInterceptor(SafeRetryInterceptor())
            .addInterceptor(logging)
            .build()
    }
    @Provides @Singleton fun retrofit(http: OkHttpClient, json: Json): Retrofit {
        val base = BuildConfig.API_BASE_URL.let { if (it.endsWith('/')) it else "$it/" }
        return Retrofit.Builder().baseUrl(base).client(http).addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build()
    }
    @Provides @Singleton fun api(retrofit: Retrofit): LoopApi = retrofit.create(LoopApi::class.java)
}

/** Refresh once on 401. Only replay idempotent GETs; writes are left to an explicit user retry. */
private class AuthRetryInterceptor(private val session: SessionManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code != 401) return response
        val fresh = session.token(forceRefresh = true)
        if (fresh == null || chain.request().method != "GET") return response
        response.close()
        return chain.proceed(chain.request().newBuilder().header("Authorization", "Bearer $fresh").build())
    }
}

/** Bounded retries for safe reads only. Financial and reward writes never auto-retry. */
private class SafeRetryInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.method != "GET") return chain.proceed(request)
        var attempt = 0
        var last: Response? = null
        var failure: IOException? = null
        while (attempt < 3) {
            last?.close()
            try {
                val response = chain.proceed(request)
                if (response.code !in setOf(429, 502, 503, 504) || attempt == 2) return response
                val wait = response.header("Retry-After")?.toLongOrNull()?.coerceIn(1, 5) ?: (attempt + 1).toLong()
                response.close(); Thread.sleep(wait * 1000)
            } catch (e: IOException) {
                failure = e
                if (attempt == 2) throw e
                Thread.sleep(((attempt + 1) * 500).toLong())
            }
            attempt++
        }
        return last ?: throw (failure ?: IOException("Request failed"))
    }
}
