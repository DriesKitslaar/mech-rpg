package com.ironwage.game;

import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowManager;

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
    /** Android key code to the KeyboardEvent.code the game maps to an action. */
    private static final Map<Integer, String> KEYS = new HashMap<>();
    static {
        KEYS.put(KeyEvent.KEYCODE_DPAD_UP, "ArrowUp");
        KEYS.put(KeyEvent.KEYCODE_DPAD_DOWN, "ArrowDown");
        KEYS.put(KeyEvent.KEYCODE_DPAD_LEFT, "ArrowLeft");
        KEYS.put(KeyEvent.KEYCODE_DPAD_RIGHT, "ArrowRight");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_A, "Enter");
        KEYS.put(KeyEvent.KEYCODE_DPAD_CENTER, "Enter");
        KEYS.put(KeyEvent.KEYCODE_ENTER, "Enter");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_B, "Escape");
        KEYS.put(KeyEvent.KEYCODE_BACK, "Escape");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_L1, "KeyQ");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_R1, "KeyE");
        KEYS.put(KeyEvent.KEYCODE_BUTTON_START, "Space");
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
