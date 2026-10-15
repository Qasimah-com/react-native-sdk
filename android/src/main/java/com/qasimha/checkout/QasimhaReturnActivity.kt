package com.qasimha.checkout

import android.app.Activity
import android.content.Intent
import android.os.Bundle

class QasimhaReturnActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val data = intent?.data
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (data != null && launch != null) {
      launch.action = Intent.ACTION_VIEW
      launch.data = data
      launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(launch)
    }
    finish()
  }
}
