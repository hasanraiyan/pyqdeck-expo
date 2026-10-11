import test from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenPermissions, FORBIDDEN_PERMISSIONS } from './manifestPermissions.mjs';

const wrap = (body) => `<manifest xmlns:android="http://schemas.android.com/apk/res/android">${body}</manifest>`;

test('flags a requested photo permission (the expo-screen-capture case)', () => {
  const xml = wrap(`
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>`);
  assert.deepEqual(forbiddenPermissions(xml), ['android.permission.READ_MEDIA_IMAGES']);
});

test('flags every forbidden permission, once each', () => {
  const xml = wrap(
    FORBIDDEN_PERMISSIONS.map((p) => `<uses-permission android:name="${p}"/>`).join('') +
      `<uses-permission android:name="${FORBIDDEN_PERMISSIONS[0]}"/>`
  );
  assert.deepEqual(forbiddenPermissions(xml).sort(), [...FORBIDDEN_PERMISSIONS].sort());
});

test('ignores permissions that are only being removed (source manifest)', () => {
  const xml = wrap(`
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" tools:node="remove"/>
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" tools:node="remove"/>`);
  assert.deepEqual(forbiddenPermissions(xml), []);
});

test('handles attributes in any order, across lines, and sdk-23 entries', () => {
  const xml = wrap(`
    <uses-permission
        android:maxSdkVersion="32"
        android:name="android.permission.READ_MEDIA_VIDEO"/>
    <uses-permission-sdk-23 android:name="android.permission.READ_MEDIA_IMAGES"/>`);
  assert.deepEqual(forbiddenPermissions(xml).sort(), [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
  ]);
});

test('does not flag allowed permissions, or non-permission tags that mention the name', () => {
  const xml = wrap(`
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
    <permission android:name="android.permission.READ_MEDIA_IMAGES"/>`);
  assert.deepEqual(forbiddenPermissions(xml), []);
});

test('empty or odd input is safe', () => {
  assert.deepEqual(forbiddenPermissions(''), []);
  assert.deepEqual(forbiddenPermissions(undefined), []);
});
