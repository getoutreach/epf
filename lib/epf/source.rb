module Epf
  module Source
    def self.bundled_path
      File.expand_path('../../../dist/epf.js', __FILE__)
    end

    def self.bundled_map_path
      File.expand_path('../../../dist/epf.js.map', __FILE__)
    end
  end
end
