desc 'Build distribution js files'
task :dist do
  puts 'Building js distribution...'
  `npm install && ./build-browser`
  puts 'Successfully built coalesce at dist/'
end

# bundler tasks
require 'bundler/gem_tasks'

desc 'Build distribution js files and publish source gem'
task :publish => [:dist, :release]

task :default => [:dist]
