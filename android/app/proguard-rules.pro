# Keep generated wire models and Retrofit generic signatures for kotlinx.serialization.
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, AnnotationDefault
-keep class com.creatorloop.core.networkapi.generated.** { *; }
-keepclassmembers class com.creatorloop.app.data.model.** { *; }
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-dontwarn org.slf4j.impl.StaticLoggerBinder
