Pod::Spec.new do |s|
  s.name = 'JourneyDeckPhotoLibrary'
  s.version = '1.0.0'
  s.summary = 'Private on-device JourneyDeck photo matching'
  s.description = 'Permission-scoped PhotoKit metadata, reviewed thumbnails and selected photo imports.'
  s.author = 'JourneyDeck'
  s.homepage = 'https://github.com/drumpat01/DriveOS'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Photos', 'PhotosUI', 'UIKit', 'CoreLocation'
  s.weak_frameworks = 'SensitiveContentAnalysis'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
