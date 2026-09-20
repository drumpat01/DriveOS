Pod::Spec.new do |s|
  s.name           = 'JourneyDeckRecorder'
  s.version        = '1.0.0'
  s.summary        = 'JourneyDeck native automatic journey recorder'
  s.description    = 'An iOS-only Core Location engine that detects, records, and durably completes automatic journeys independently of React Native.'
  s.author         = 'JourneyDeck'
  s.homepage       = 'https://github.com/drumpat01/DriveOS'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreLocation', 'MapKit', 'UIKit', 'WatchConnectivity', 'JavaScriptCore', 'StoreKit'
  s.resource_bundles = { 'JourneyDeckAsk' => ['AskResources/*.{js,json}'] }
  s.libraries = 'sqlite3'
  sdk_version = `xcrun --sdk iphoneos --show-sdk-version 2>/dev/null`.strip
  s.weak_frameworks = 'FoundationModels' if !sdk_version.empty? && Gem::Version.new(sdk_version) >= Gem::Version.new('26.0')
  duo_sdk = !sdk_version.empty? && Gem::Version.new(sdk_version) >= Gem::Version.new('27.1')
  swift_conditions = '$(inherited)'
  swift_conditions += ' JOURNEYDECK_DUO_RESERVED_REGIONS' if duo_sdk
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => swift_conditions
  }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
