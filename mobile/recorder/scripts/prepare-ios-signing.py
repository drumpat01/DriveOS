"""Registered-device signing on an ephemeral GitHub Mac. Never prints secret values."""
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shutil
import subprocess
import sys

MAIN = 'com.journeydeck.recorder.v3'
WATCH = MAIN + '.watchkitapp'
REQUIRED = ['IOS_DISTRIBUTION_P12_BASE64', 'IOS_DISTRIBUTION_P12_PASSWORD',
            'IOS_V3_PROFILE_BASE64', 'IOS_V3_WATCH_PROFILE_BASE64',
            'IOS_TEST_DEVICE_UDID', 'IOS_ARTIFACT_PASSWORD']


def preflight():
    missing = [key for key in REQUIRED if not os.environ.get(key)]
    if missing:
        raise ValueError('Missing repository secrets: ' + ', '.join(missing))
    if not re.fullmatch(r'[0-9A-Fa-f-]{24,40}', os.environ['IOS_TEST_DEVICE_UDID']):
        raise ValueError('Invalid device identifier format')
    if len(os.environ['IOS_ARTIFACT_PASSWORD']) < 32:
        raise ValueError('Use at least 32 random characters for IOS_ARTIFACT_PASSWORD')


def validate_profile(profile, bundle, device=None):
    team = profile.get('TeamIdentifier', [''])[0]
    entitlements = profile.get('Entitlements', {})
    if not re.fullmatch(r'[A-Z0-9]{10}', team):
        raise ValueError('Invalid signing team')
    prefixes = profile.get('ApplicationIdentifierPrefix', [])
    if not any(entitlements.get('application-identifier') == prefix + '.' + bundle for prefix in prefixes):
        raise ValueError('Provisioning profile belongs to another app')
    if profile.get('ExpirationDate', datetime.datetime.min) <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
        raise ValueError('Provisioning profile has expired')
    devices = profile.get('ProvisionedDevices', [])
    if not devices or entitlements.get('get-task-allow', False) or profile.get('ProvisionsAllDevices', False):
        raise ValueError('An ad hoc distribution profile is required')
    if device and device.lower() not in [value.lower() for value in devices]:
        raise ValueError('The registered iPhone is not included in the app profile')
    if bundle == MAIN:
        if 'iCloud.' + MAIN not in entitlements.get('com.apple.developer.icloud-container-identifiers', []):
            raise ValueError('The V3 CloudKit container is missing from the profile')
        services = entitlements.get('com.apple.developer.icloud-services', [])
        if isinstance(services, str):
            services = [services]
        # Profiles are entitlement allowlists; Apple may authorize all iCloud
        # services with '*', while the app still claims CloudKit explicitly.
        if 'CloudKit' not in services and '*' not in services:
            raise ValueError('CloudKit is missing from the app profile')
        cloudkit_environment(profile)
        if 'Default' not in entitlements.get('com.apple.developer.applesignin', []):
            raise ValueError('Sign in with Apple is missing from the app profile')
    if not re.fullmatch(r'[A-Fa-f0-9-]{36}', profile.get('UUID', '')):
        raise ValueError('Invalid profile UUID')
    return team


def cloudkit_environment(profile):
    allowed = profile.get('Entitlements', {}).get('com.apple.developer.icloud-container-environment', [])
    if isinstance(allowed, str):
        allowed = [allowed]
    if 'Production' not in allowed and '*' not in allowed:
        raise ValueError('The profile must authorize the existing Production CloudKit environment')
    # ExportOptions requires one string, not the profile's array of allowed values.
    return 'Production'


def run(*args):
    # Private command output can contain identity metadata. Only sanitized errors escape.
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def install(directory):
    preflight()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    profiles = {}
    for bundle, variable in [(MAIN, 'IOS_V3_PROFILE_BASE64'), (WATCH, 'IOS_V3_WATCH_PROFILE_BASE64')]:
        path = directory / (('app' if bundle == MAIN else 'watch') + '.mobileprovision')
        path.write_bytes(base64.b64decode(os.environ[variable], validate=True))
        profile = plistlib.loads(run('security', 'cms', '-D', '-i', str(path)))
        validate_profile(profile, bundle, os.environ['IOS_TEST_DEVICE_UDID'] if bundle == MAIN else None)
        profiles[bundle] = profile
    teams = {p['TeamIdentifier'][0] for p in profiles.values()}
    if len(teams) != 1:
        raise ValueError('App and Watch profiles must use the same signing team')
    keychain = directory / 'signing.keychain-db'
    password = secrets.token_urlsafe(32)
    certificate = directory / 'distribution.p12'
    certificate.write_bytes(base64.b64decode(os.environ['IOS_DISTRIBUTION_P12_BASE64'], validate=True))
    run('security', 'create-keychain', '-p', password, str(keychain))
    run('security', 'set-keychain-settings', '-lut', '21600', str(keychain))
    run('security', 'unlock-keychain', '-p', password, str(keychain))
    run('security', 'import', str(certificate), '-P', os.environ['IOS_DISTRIBUTION_P12_PASSWORD'], '-A', '-t', 'cert', '-f', 'pkcs12', '-k', str(keychain))
    run('security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-k', password, str(keychain))
    run('security', 'list-keychains', '-d', 'user', '-s', str(keychain))
    identity_output = run('security', 'find-identity', '-v', '-p', 'codesigning', str(keychain)).decode()
    identities = set(re.findall(r'\b[A-F0-9]{40}\b', identity_output))
    for profile in profiles.values():
        identities &= {hashlib.sha1(cert).hexdigest().upper() for cert in profile.get('DeveloperCertificates', [])}
    if len(identities) != 1:
        raise ValueError('Both profiles must authorize the imported signing identity')
    mapping = {bundle: p['UUID'] for bundle, p in profiles.items()}
    # Xcode 16+ profile location, plus the legacy location for installed toolchains.
    for folder in [Path.home() / 'Library/Developer/Xcode/UserData/Provisioning Profiles', Path.home() / 'Library/MobileDevice/Provisioning Profiles']:
        folder.mkdir(parents=True, exist_ok=True)
        for bundle, uuid in mapping.items():
            shutil.copyfile(directory / (('app' if bundle == MAIN else 'watch') + '.mobileprovision'), folder / (uuid + '.mobileprovision'))
    settings = {'team': next(iter(teams)), 'identity': next(iter(identities)), 'profiles': mapping}
    (directory / 'settings.json').write_text(json.dumps(settings))
    environment = cloudkit_environment(profiles[MAIN])
    with (directory / 'ExportOptions.plist').open('wb') as output:
        plistlib.dump({'method': 'release-testing', 'teamID': settings['team'], 'signingStyle': 'manual',
                      'signingCertificate': settings['identity'], 'provisioningProfiles': mapping,
                      'iCloudContainerEnvironment': environment, 'manageAppVersionAndBuildNumber': False}, output)
    print('Signing profiles validated for V3, CloudKit, Watch, and the registered iPhone.')


def cleanup(directory):
    if not directory.exists():
        return
    try:
        run('security', 'delete-keychain', str(directory / 'signing.keychain-db'))
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    settings = directory / 'settings.json'
    if settings.exists():
        for uuid in json.loads(settings.read_text())['profiles'].values():
            if not re.fullmatch(r'[A-Fa-f0-9-]{36}', uuid):
                continue
            for relative in ['Library/Developer/Xcode/UserData/Provisioning Profiles', 'Library/MobileDevice/Provisioning Profiles']:
                (Path.home() / relative / (uuid + '.mobileprovision')).unlink(missing_ok=True)
    shutil.rmtree(directory)


if __name__ == '__main__':
    try:
        mode = sys.argv[1]
        if mode == 'preflight':
            preflight()
        else:
            if sys.platform != 'darwin' or not os.environ.get('RUNNER_TEMP') or os.environ.get('GITHUB_ACTIONS') != 'true':
                raise ValueError('Signing is restricted to the ephemeral GitHub Mac runner')
            directory = Path(os.environ['RUNNER_TEMP']).resolve() / 'journeydeck-signing'
            if mode == 'install':
                install(directory)
            elif mode == 'cleanup':
                cleanup(directory)
            else:
                raise ValueError('Unknown signing operation')
    except ValueError as error:
        print('::error::' + str(error)); sys.exit(1)
    except Exception:
        print('::error::Signing operation failed. Check the certificate, password, and profiles.'); sys.exit(1)
