Pod::Spec.new do |s|
  s.name           = 'JourneyDeckMembership'
  s.version        = '1.0.0'
  s.summary        = 'JourneyDeck StoreKit membership bridge'
  s.description    = 'A private StoreKit 2 bridge for verified JourneyDeck subscription entitlements.'
  s.author         = 'JourneyDeck'
  s.homepage       = 'https://github.com/drumpat01/DriveOS'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
