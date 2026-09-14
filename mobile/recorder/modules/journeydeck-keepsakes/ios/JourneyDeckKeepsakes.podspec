Pod::Spec.new do |s|
  s.name           = 'JourneyDeckKeepsakes'
  s.version        = '1.0.0'
  s.summary        = 'JourneyDeck native milestone medallions'
  s.description    = 'A private Expo view bridge for interactive JourneyDeck keepsakes rendered by Minted.'
  s.author         = 'JourneyDeck'
  s.homepage       = 'https://github.com/drumpat01/DriveOS'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit', 'SwiftUI', 'SceneKit'
  spm_dependency(s,
    url: 'https://github.com/haplollc/Minted.git',
    requirement: { kind: 'exactVersion', version: '1.1.1' },
    products: ['Minted'])

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
