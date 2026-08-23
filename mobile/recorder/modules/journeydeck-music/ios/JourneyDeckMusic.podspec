Pod::Spec.new do |s|
  s.name           = 'JourneyDeckMusic'
  s.version        = '1.0.0'
  s.summary        = 'JourneyDeck Apple Music and ShazamKit bridge'
  s.description    = 'A private iOS bridge that reads authorized Apple Music history and performs bounded ShazamKit recognition.'
  s.author         = 'JourneyDeck'
  s.homepage       = 'https://github.com/drumpat01/DriveOS'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'MediaPlayer', 'MusicKit', 'ShazamKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
