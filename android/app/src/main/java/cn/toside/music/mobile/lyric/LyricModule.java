package cn.toside.music.mobile.lyric;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

public class LyricModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;
  Lyric lyric;
  // final Map<String, Object> constants = new HashMap<>();

  boolean isShowTranslation = false;
  boolean isShowRoma = false;
  float playbackRate = 1;

  private int listenerCount = 0;

  private String currentLyric = "";
  private String currentTranslation = "";

  private BroadcastReceiver lyricRequestReceiver;
  private boolean isSendLyricBroadcast = false;

  LyricModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    registerLyricRequestReceiver();

    // constants.put("THEME_GREEN", "#07c556");
    // constants.put("THEME_YELLOW", "#fffa12");
    // constants.put("THEME_BLUE", "#19b5fe");
    // constants.put("THEME_RED", "#ff1222");
    // constants.put("THEME_PINK", "#f1828d");
    // constants.put("THEME_PURPLE", "#c851d4");
    // constants.put("THEME_ORANGE", "#fffa12");
    // constants.put("THEME_GREY", "#bdc3c7");
  }

  private void registerLyricRequestReceiver() {
    IntentFilter filter = new IntentFilter("cn.toside.music.mobile.LYRIC_BROADCAST_REQUEST");
    lyricRequestReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        Log.d("LyricModule", "Received LYRIC_BROADCAST_REQUEST, resending current lyric");
        if (isSendLyricBroadcast) {
          sendLyricBroadcast();
        }
      }
    };
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(lyricRequestReceiver, filter, Context.RECEIVER_EXPORTED);
    } else {
      reactContext.registerReceiver(lyricRequestReceiver, filter);
    }
  }

  private void sendLyricBroadcast() {
    if (!isSendLyricBroadcast) return;
    if (currentLyric == null || currentLyric.isEmpty()) return;
    Intent intent = new Intent("cn.toside.music.mobile.LYRIC_BROADCAST");
    intent.putExtra("lyric", currentLyric);
    if (currentTranslation != null && !currentTranslation.isEmpty()) {
      intent.putExtra("translatedlyric", currentTranslation);
    }
    reactContext.sendBroadcast(intent);
    Log.d("LyricModule", "Lyric broadcast resent on request");
  }

  @ReactMethod
  public void setSendLyricBroadcast(boolean isSend, Promise promise) {
    this.isSendLyricBroadcast = isSend;
    if (isSend) {
      sendLyricBroadcast();
    }
    promise.resolve(null);
  }

  @Override
  public String getName() {
    return "LyricModule";
  }

//  @Override
//  public Map<String, Object> getConstants() {
//    return constants;
//  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  @ReactMethod
  public void showDesktopLyric(ReadableMap data, Promise promise) {
    if (lyric == null) lyric = new Lyric(reactContext, isShowTranslation, isShowRoma, playbackRate);
    lyric.showDesktopLyric(Arguments.toBundle(data), promise);
  }

  @ReactMethod
  public void hideDesktopLyric(Promise promise) {
    if (lyric != null) lyric.hideDesktopLyric();
    promise.resolve(null);
  }

  @ReactMethod
  public void setSendLyricTextEvent(boolean isSend, Promise promise) {
    if (lyric == null) lyric = new Lyric(reactContext, isShowTranslation, isShowRoma, playbackRate);
    lyric.setSendLyricTextEvent(isSend);
    promise.resolve(null);
  }


  @ReactMethod
  public void setLyric(String lyric, String translation, String romaLyric, Promise promise) {
    // Log.d("Lyric", "set lyric: " + lyric);
    // Log.d("Lyric", "set lyric translation: " + translation);
    boolean lyricChanged = !currentLyric.equals(lyric);

    currentLyric = lyric;
    currentTranslation = translation;

    if (this.lyric != null) {
      this.lyric.setLyric(lyric, translation, romaLyric);
    }

    // 歌词变化时才发送广播，避免重复发送
    if (lyricChanged) {
      sendLyricBroadcast();
    }

    promise.resolve(null);
  }

  @ReactMethod
  public void setPlaybackRate(float playbackRate, Promise promise) {
    this.playbackRate = playbackRate;
    if (lyric != null) lyric.setPlaybackRate(playbackRate);
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleTranslation(boolean isShowTranslation, Promise promise) {
    this.isShowTranslation = isShowTranslation;
    if (lyric != null) lyric.toggleTranslation(isShowTranslation);
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleRoma(boolean isShowRoma, Promise promise) {
    this.isShowRoma = isShowRoma;
    if (lyric != null) lyric.toggleRoma(isShowRoma);
    promise.resolve(null);
  }

  @ReactMethod
  public void play(int time, Promise promise) {
    Log.d("Lyric", "play lyric: " + time);
    if (lyric != null) lyric.play(time);
    promise.resolve(null);
  }

  @ReactMethod
  public void pause(Promise promise) {
    Log.d("Lyric", "play pause");
    if (lyric != null) lyric.pauseLyric();
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleLock(boolean isLock, Promise promise) {
    if (lyric != null) {
      if (isLock) {
        lyric.lockLyric();
      } else {
        lyric.unlockLyric();
      }
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void setColor(String unplayColor, String playedColor, String shadowColor, Promise promise) {
    if (lyric != null) lyric.setPlayedColor(unplayColor, playedColor, shadowColor);
    promise.resolve(null);
  }

  @ReactMethod
  public void setAlpha(float alpha, Promise promise) {
    if (lyric != null) lyric.setAlpha(alpha);
    promise.resolve(null);
  }

  @ReactMethod
  public void setTextSize(float size, Promise promise) {
    if (lyric != null) lyric.setTextSize(size);
    promise.resolve(null);
  }

  @ReactMethod
  public void setMaxLineNum(int maxLineNum, Promise promise) {
    if (lyric != null) lyric.setMaxLineNum(maxLineNum);
    promise.resolve(null);
  }

  @ReactMethod
  public void setSingleLine(boolean singleLine, Promise promise) {
    if (lyric != null) lyric.setSingleLine(singleLine);
    promise.resolve(null);
  }

  @ReactMethod
  public void setShowToggleAnima(boolean showToggleAnima, Promise promise) {
    if (lyric != null) lyric.setShowToggleAnima(showToggleAnima);
    promise.resolve(null);
  }

  @ReactMethod
  public void setWidth(int width, Promise promise) {
    if (lyric != null) lyric.setWidth(width);
    promise.resolve(null);
  }

  @ReactMethod
  public void setLyricTextPosition(String positionX, String positionY, Promise promise) {
    if (lyric != null) lyric.setLyricTextPosition(positionX, positionY);
    promise.resolve(null);
  }

  @ReactMethod
  public void checkOverlayPermission(Promise promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      promise.reject(new Exception("Permission denied"));
    }
    promise.resolve(null);
  }

  @ReactMethod
  public void openOverlayPermissionActivity(Promise promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactContext.getApplicationContext().getPackageName()));
      reactContext.startActivityForResult(intent, 1, null);
    }
    promise.resolve(null);
  }

}
