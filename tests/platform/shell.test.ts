import { readFileSync } from 'node:fs';

/**
 * The page and the Android shell are written in two languages and built by two tools, and nothing
 * else checks that they still mean the same thing by the one name they share.
 */
test('the page and the Android shell agree on what the shell is called and what it offers', () => {
  const java = readFileSync('android/app/src/main/java/com/ironwage/game/MainActivity.java', 'utf8');
  const page = readFileSync('src/main.ts', 'utf8');
  expect(java).toMatch(/addJavascriptInterface\(new Shell\(this\), "IronwageShell"\)/);
  expect(java).toMatch(/@JavascriptInterface\s+public void vibrate\(int ms\)/);
  expect(page).toContain('IronwageShell');
});

test('the shell may run the motor and lets the page make sound without a touch', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  const java = readFileSync('android/app/src/main/java/com/ironwage/game/MainActivity.java', 'utf8');
  expect(manifest).toContain('android.permission.VIBRATE');
  expect(java).toContain('setMediaPlaybackRequiresUserGesture(false)');
});

test('the launch screen of Android 12 and later is given a colour and an icon that exist', () => {
  const styles = readFileSync('android/app/src/main/res/values/styles.xml', 'utf8');
  expect(styles).toContain('<item name="windowSplashScreenBackground">@color/ic_launcher_background</item>');
  expect(styles).toContain('<item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>');
  expect(readFileSync('android/app/src/main/res/values/ic_launcher_background.xml', 'utf8')).toContain('name="ic_launcher_background"');
  expect(() => readFileSync('android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png')).not.toThrow();
});
