Pod::Spec.new do |s|
  s.name           = 'JourneyDeckAppIcon'
  s.version        = '1.0.0'
  s.summary        = 'JourneyDeck alternate app icon bridge'
  s.description    = 'A private UIKit bridge for selecting JourneyDeck alternate app icons.'
  s.author         = 'JourneyDeck'
  s.homepage       = 'https://github.com/drumpat01/DriveOS'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
