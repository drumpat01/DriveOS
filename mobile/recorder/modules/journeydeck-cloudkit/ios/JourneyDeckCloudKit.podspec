Pod::Spec.new do |s|
  s.name           = 'JourneyDeckCloudKit'
  s.version        = '1.0.0'
  s.summary        = 'JourneyDeck private CloudKit transport'
  s.description    = 'An iOS-only Expo module that synchronizes privacy-safe JourneyDeck records through each user profile private CloudKit zone.'
  s.author         = 'JourneyDeck'
  s.homepage       = 'https://github.com/drumpat01/DriveOS'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CloudKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
