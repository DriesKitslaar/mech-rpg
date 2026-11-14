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

test('every key the shell sends is one the page listens for, and the pad\'s A and B go under names of their own', async () => {
  const { KEY_MAP, FACE_KEYS } = await import('../../src/platform/input');
  const java = readFileSync('android/app/src/main/java/com/ironwage/game/MainActivity.java', 'utf8');
  const sent = Object.fromEntries([...java.matchAll(/KEYS\.put\(KeyEvent\.KEYCODE_(\w+), "(\w+)"\)/g)].map((m) => [m[1], m[2]]));
  expect(Object.keys(sent).length).toBeGreaterThanOrEqual(12);
  for (const [key, code] of Object.entries(sent)) expect(Object.hasOwn(KEY_MAP, code), `${key} is sent as ${code}`).toBe(true);
  // The two buttons the options can swap are told apart from everything else that confirms or goes back.
  expect(sent.BUTTON_A).toBe('ButtonA');
  expect(sent.BUTTON_B).toBe('ButtonB');
  expect([sent.BACK, sent.ENTER, sent.DPAD_CENTER]).toEqual(['Escape', 'Enter', 'Enter']);
  for (const [key, code] of Object.entries(sent)) expect(FACE_KEYS.has(code), key).toBe(key === 'BUTTON_A' || key === 'BUTTON_B');
});

test('the picture stays the way the handheld is held, and the game has the whole screen from the start', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  // Not sensorLandscape: a handheld with fixed controls must not turn its picture upside down.
  expect(manifest).toContain('android:screenOrientation="landscape"');
  const config = readFileSync('capacitor.config.ts', 'utf8');
  // The framework's own system-bars plugin would otherwise show the bars at load and pad the page by them.
  expect(config).toMatch(/SystemBars:\s*\{[^}]*hidden:\s*true/);
  expect(config).toMatch(/SystemBars:\s*\{[^}]*insetsHandling:\s*'disable'/);
});
