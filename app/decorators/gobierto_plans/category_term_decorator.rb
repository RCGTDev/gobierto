# frozen_string_literal: true

module GobiertoPlans
  class CategoryTermDecorator < BaseTermDecorator
    include ActionView::Helpers::NumberHelper

    def initialize(term, options = {})
      @object = term
      @vocabulary = options[:vocabulary]
      @plan = options[:plan]
      @site = options[:site]
    end

    def categories
      terms
    end

    def site
      @site ||= vocabulary.site
    end

    def plan
      @plan ||= site.plans.find_by_vocabulary_id(vocabulary.id)
    end

    def uid
      @uid ||= begin
                 category = object
                 indices = []
                 while category.present?
                   same_level_ids = plan.categories.where(level: category.level, term_id: category.term_id).sorted.pluck(:id)
                   indices.unshift(same_level_ids.index(category.id))
                   category = category.parent_term
                 end
                 indices.join(".")
               end
    end

    def progress
      return if nodes_count.zero?

      @progress ||= descending_nodes.average(:progress).to_f
    end

    def progress_percentage
      return if nodes_count.zero?

      @progress_percentage ||= number_to_percentage(progress, precision: 1, strip_insignificant_zeros: true)
    end

    def nodes_count
      @nodes_count ||= descending_nodes.count
    end

    def parent_id
      @parent_id ||= object.term_id
    end

    def nodes
      plan.nodes.where(gplan_categories_nodes: { category_id: object.id })
    end

    def nodes_data
      CollectionDecorator.new(nodes.published, decorator: GobiertoPlans::ProjectDecorator).map.with_index do |node, index|
        node = node.at_current_version
        { id: node.id,
          uid: uid + "." + index.to_s,
          type: "node",
          level: level + 1,
          attributes: { title: node.name_translations,
                        parent_id: id,
                        progress: node.progress,
                        starts_at: node.starts_at,
                        ends_at: node.ends_at,
                        status: node.status&.name_translations,
                        options: node.options,
                        plugins_data: node_plugins_data(plan, node),
                        custom_field_records: node_custom_field_records(node)
          },
          children: [] }
      end
    end

    def has_dependent_resources?
      plan.present? && progress.present?
    end

    def self.decorated_values?
      true
    end

    def self.decorated_header_template
      "header"
    end

    def self.decorated_values_template
      "values"
    end

    def self.decorated_resources_template
      "resources"
    end

    def decorated_values
      { items: nodes_count, progress: progress_percentage }
    end

    def decorated_resources
      return if nodes_count.zero?

      { projects: nodes, plan: plan }
    end

    protected

    def descending_nodes
      @descending_nodes ||= plan.nodes.where("gplan_categories_nodes.category_id IN (#{self.class.tree_sql_for(self)})")
    end

    def vocabulary
      @vocabulary ||= object.vocabulary
    end

    private

    def node_plugins_data(plan, node)
      {}
    end

    def node_custom_field_records(node)
      ::GobiertoPlans::Node.node_custom_field_records(plan, node).map do |record|
        next if record.custom_field.field_type == "plugin"

        {
          value: record.value,
          raw_value: record.raw_value,
          custom_field_name_translations: record.custom_field.name_translations,
          custom_field_field_type: record.custom_field.field_type
        }
      end
    end

  end
end
