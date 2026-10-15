package com.qasimha.checkout

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Browser
import androidx.browser.customtabs.CustomTabsIntent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class QasimhaCheckoutModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  private var pending: Promise? = null
  private var inBrowser = false
  private var closing = false

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun open(paymentUrl: String, options: ReadableMap, promise: Promise) {
    val uri = Uri.parse(paymentUrl)
    if (!"https".equals(uri.scheme, ignoreCase = true) || uri.host.isNullOrEmpty()) {
      promise.reject("INVALID_URL", "paymentUrl must be an https URL")
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No foreground activity to present the checkout from")
      return
    }
    if (pending != null) {
      promise.reject("IN_PROGRESS", "A checkout is already presented")
      return
    }
    val tab = CustomTabsIntent.Builder()
      .setShowTitle(true)
      .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
      .setUrlBarHidingEnabled(false)
      .build()
    val language = if (options.hasKey("language")) options.getString("language") else null
    if (!language.isNullOrEmpty()) {
      tab.intent.putExtra(Browser.EXTRA_HEADERS, Bundle().apply { putString("Accept-Language", language) })
    }
    tab.intent.putExtra(Intent.EXTRA_REFERRER, Uri.parse("android-app://" + activity.packageName))
    pending = promise
    inBrowser = false
    closing = false
    try {
      tab.launchUrl(activity, uri)
    } catch (e: ActivityNotFoundException) {
      pending = null
      promise.reject("NO_BROWSER", "No browser is available to present the checkout")
    }
  }

  @ReactMethod
  fun close(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (pending != null && activity != null) {
      closing = true
      val intent = Intent(activity, activity.javaClass)
        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      activity.startActivity(intent)
    }
    promise.resolve(null)
  }

  override fun onHostPause() {
    if (pending != null) inBrowser = true
  }

  override fun onHostResume() {
    val promise = pending ?: return
    if (!inBrowser) return
    val dismissed = !closing
    pending = null
    inBrowser = false
    closing = false
    promise.resolve(Arguments.createMap().apply { putBoolean("dismissed", dismissed) })
  }

  override fun onHostDestroy() {
    pending?.reject("HOST_DESTROYED", "The activity was destroyed while the checkout was presented")
    pending = null
    inBrowser = false
    closing = false
  }

  companion object {
    const val NAME = "QasimhaCheckout"
  }
}
