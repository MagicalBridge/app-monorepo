import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNCloudFs from 'react-native-cloud-fs';

// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import googlePlayService from '../googlePlayService/googlePlayService';
import platformEnv from '../platformEnv';

const GoogleSignInConfigure = {
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: platformEnv.isDev
    ? '117481276073-fs7omuqsmvgtg6bci3ja1gvo03g0d984.apps.googleusercontent.com' // Dev
    : '94391474021-ffaspa4ikjqpqvn5ndplqobvuvhnj8v3.apps.googleusercontent.com', // Pro
  offlineAccess: true,
};

export function backupPlatform() {
  return { cloudName: 'Google Drive', platform: 'Google' };
}

export async function isAvailable(): Promise<boolean> {
  return googlePlayService.isAvailable();
}

export async function loginIfNeeded(
  showSignInDialog: boolean,
): Promise<boolean> {
  const signedIn = await GoogleSignin.isSignedIn();
  if (signedIn) {
    try {
      return await RNCloudFs.loginIfNeeded();
    } catch (error) {
      // debugLogger.cloudBackup.error(error);
      return Promise.resolve(false);
    }
  } else if (showSignInDialog) {
    GoogleSignin.configure(GoogleSignInConfigure);
    await GoogleSignin.signIn();
    return RNCloudFs.loginIfNeeded();
  }
  return Promise.resolve(false);
}

export async function logoutFromGoogleDrive(
  revokeAccess: boolean,
): Promise<boolean> {
  if (platformEnv.isNativeAndroid) {
    if (revokeAccess) {
      await GoogleSignin.revokeAccess();
    }
    await GoogleSignin.signOut();
    return RNCloudFs.logout();
  }
  return Promise.resolve(true);
}

export function sync(): Promise<boolean> {
  return Promise.resolve(true);
}

export async function listFiles(target: string) {
  await loginIfNeeded(false);
  const { files }: { files: Array<{ isFile: boolean; name: string }> } =
    await RNCloudFs.listFiles({ scope: 'hidden', targetPath: target });
  return files.map(({ name }) => name.replace(target, ''));
}

async function getFileObject(
  target: string,
): Promise<{ id: string; name: string } | undefined> {
  const { files }: { files: Array<{ id: string; name: string }> } =
    await RNCloudFs.listFiles({
      scope: 'hidden',
      targetPath: target,
    });
  return files.find(({ name }) => target === name);
}

export async function deleteFile(target: string): Promise<boolean> {
  await loginIfNeeded(false);
  const file = await getFileObject(target);
  if (file) {
    await RNCloudFs.deleteFromCloud(file);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

export async function downloadFromCloud(target: string): Promise<string> {
  await loginIfNeeded(false);
  const file = await getFileObject(target);
  if (file) {
    return RNCloudFs.getGoogleDriveDocument(file.id);
  }
  return Promise.resolve('');
}

export async function uploadToCloud(
  source: string,
  target: string,
): Promise<void> {
  await loginIfNeeded(false);
  await RNCloudFs.copyToCloud({
    mimeType: null,
    scope: 'hidden',
    sourcePath: { path: source },
    targetPath: target,
  });
}
