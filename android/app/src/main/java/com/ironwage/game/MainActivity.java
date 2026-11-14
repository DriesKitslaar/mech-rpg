package com.ironwage.game;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import java.util.HashMap;
import java.util.Map;

/**
 * Runs the game full screen and turns controller buttons into the keyboard keys the game listens for.
 * Handling them here, before the web view sees them, keeps the B button from closing the app
 * and makes every handheld behave the same.
 */
public class MainActivity extends BridgeActivity {
    /**
     * Android key code to the KeyboardEvent.code the game maps to an action. The pad's A and B go
     * under names of their own, not as Enter and Escape: the game's options can swap those two, for a
     * handheld that reports them the other way round, and that must not change what Back does.
     */
    private static final Map<Integer, String> KEYS = new HashMap<>();
    static {
        KEYS.put(KeyEvent.KEYCODE_DPAD_UP, "ArrowUp");
        KEYS.put(KeyEvent.KEYCODE_DPAD_DOWN, "ArrowDown");
        KEYS.put(KeyEvent.KEYCODE_DPAD_LEFT, "ArrowLeft");
        KEYS.put(KeyEvent.KEYCODE_DPAD_RIGHT, "ArrowRight");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_A, "ButtonA");
        KEYS.put(KeyEvent.KEYCODE_DPAD_CENTER, "Enter");
        KEYS.put(KeyEvent.KEYCODE_ENTER, "Enter");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_B, "ButtonB");
        KEYS.put(KeyEvent.KEYCODE_BACK, "Escape");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_L1, "KeyQ");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_R1, "KeyE");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_START, "Space");
    }

    /**
     * What the page may ask of the shell. The page cannot make the handheld rumble by itself:
     * controller presses reach it as script-made key events, which a browser does not count as a
     * user gesture, and without one its own vibrate call is refused.
     */
    public static class Shell {
        /** No rumble the game asks for is longer than this; anything longer is cut to it. */
        private static final int MAX_MS = 400;
        private final Vibrator vibrator;

        Shell(Context context) {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }

        /** Runs the motor for a number of milliseconds. A device without one is left alone. */
        @JavascriptInterface
        public void vibrate(int ms) {
            if (vibrator == null || !vibrator.hasVibrator() || ms <= 0) return;
            int length = Math.min(ms, MAX_MS);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(length, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(length);
                }
            } catch (RuntimeException e) {
                // A motor that will not run is no reason to stop the game.
            }
        }
    }

    /** Which arrow the D-pad currently holds when it reports as an axis instead of keys. */
    private String hatX = null;
    private String hatY = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
        // Controller presses reach the page as synthetic key events, which browsers do not count
        // as a user gesture; without this the game would never be allowed to make a sound.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        // For the same reason the page asks the shell to run the motor; see Shell.
        getBridge().getWebView().addJavascriptInterface(new Shell(this), "IronwageShell");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private void runJs(String js) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(js, null);
        }
    }

    private void sendKey(String type, String code) {
        runJs("window.dispatchEvent(new KeyboardEvent('" + type + "',{code:'" + code + "'}));");
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        String code = KEYS.get(keyCode);
        boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
        if (down && event.getRepeatCount() == 0) {
            // Lets the in-game input readout show which button this was, mapped or not.
            runJs("window.__nativeKey&&window.__nativeKey(" + keyCode + ",'" + (code == null ? "" : code) + "');");
        }
        if (code == null) return super.dispatchKeyEvent(event);
        // The game does its own key repeat, so held-key repeats from the system are dropped.
        if (down && event.getRepeatCount() == 0) sendKey("keydown", code);
        else if (event.getAction() == KeyEvent.ACTION_UP) sendKey("keyup", code);
        return true;
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        boolean fromPad = (event.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
            || (event.getSource() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD;
        if (!fromPad || event.getAction() != MotionEvent.ACTION_MOVE) return super.dispatchGenericMotionEvent(event);

        float x = event.getAxisValue(MotionEvent.AXIS_HAT_X);
        float y = event.getAxisValue(MotionEvent.AXIS_HAT_Y);
        hatX = moveHat(hatX, x < -0.5f ? "ArrowLeft" : x > 0.5f ? "ArrowRight" : null);
        hatY = moveHat(hatY, y < -0.5f ? "ArrowUp" : y > 0.5f ? "ArrowDown" : null);
        return true;
    }

    /** Releases the arrow held before and presses the new one, when they differ. */
    private String moveHat(String held, String now) {
        if (held == null ? now == null : held.equals(now)) return held;
        if (held != null) sendKey("keyup", held);
        if (now != null) sendKey("keydown", now);
        return now;
    }
}
