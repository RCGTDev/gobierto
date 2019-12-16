# frozen_string_literal: true

module GobiertoData
  class VisualizationForm < BaseForm

    attr_accessor(
      :id,
      :site_id,
      :query_id,
      :user_id,
      :name_translations
    )

    attr_writer(
      :privacy_status,
      :spec
    )

    validates :query, :site, :user, :spec, presence: true
    validates :name_translations, translated_attribute_presence: true
    validate :spec_validation

    delegate :persisted?, to: :visualization

    def visualization
      @visualization ||= visualization_class.find_by(id: id) || build_visualization
    end

    def query
      @query ||= site.queries.find_by(id: query_id)
    end

    def user
      @user ||= site.users.find_by(id: user_id)
    end

    def privacy_status
      @privacy_status ||= :open
    end

    def spec
      @spec ||= {}
    end

    def save
      save_visualization if valid?
    end

    private

    def build_visualization
      visualization_class.new
    end

    def visualization_class
      Visualization
    end

    def save_visualization
      @visualization = visualization.tap do |attributes|
        attributes.query_id = query_id
        attributes.user_id = user_id
        attributes.name_translations = name_translations
        attributes.privacy_status = privacy_status
        attributes.spec = spec
      end

      return @visualization if @visualization.save

      promote_errors(@visualization.errors)

      false
    end

    def site
      @site ||= Site.find_by(id: site_id)
    end

    def spec_validation
      return if spec.blank?
    end
  end
end
