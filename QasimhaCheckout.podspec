require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "QasimhaCheckout"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://api.qasimha.com"
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "13.4" }
  s.source       = { :git => ".", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.9"
  s.frameworks = "SafariServices", "AuthenticationServices"
  s.resource_bundles = { "QasimhaCheckoutPrivacy" => ["ios/PrivacyInfo.xcprivacy"] }
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
