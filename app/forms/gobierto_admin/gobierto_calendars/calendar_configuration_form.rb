# frozen_string_literal: true

module GobiertoAdmin
  module GobiertoCalendars
    class CalendarConfigurationForm < BaseForm

      ENCRYPTED_SETTING_PLACEHOLDER = 'encrypted_setting_placeholder'

      attr_accessor(
        :current_site,
        :calendar_integration,
        :collection,
        :calendar_integration_class,
        :ibm_notes_usr,
        :ibm_notes_pwd,
        :ibm_notes_url,
        :microsoft_exchange_usr,
        :microsoft_exchange_pwd,
        :microsoft_exchange_url,
        :clear_calendar_configuration,
        :calendars,
        :filtering_rules,
        :without_description
      )

      validates(
        :ibm_notes_usr,
        :ibm_notes_pwd,
        :ibm_notes_url,
        presence: true, if: -> { calendar_integration == 'ibm_notes' && !clear_calendar_configuration? }
      )

      validates(
        :microsoft_exchange_usr,
        :microsoft_exchange_pwd,
        :microsoft_exchange_url,
        presence: true, if: -> { calendar_integration == 'microsoft_exchange' && !clear_calendar_configuration? }
      )

      validates(
        :calendars,
        presence: true, if: -> { calendar_integration == 'google_calendar' && !clear_calendar_configuration? }
      )

      validates :collection, presence: true

      def initialize(attributes)
        # FIXME: manually assigning collection
        # I don't know why collection is not assigned in the initializer to @collection
        @collection = attributes[:collection]
        super(attributes)
      end

      def save
        if clear_calendar_configuration?
          ::GobiertoPeople::ClearImportedPersonEventsJob.perform_later(collection.container)
          calendar_configuration.destroy
          true
        elsif valid?
          save_calendar_configuration
        end
      end

      def filtering_rules
        @filtering_rules ||= if calendar_configuration.persisted?
                               calendar_configuration.filtering_rules.presence || [calendar_configuration.filtering_rules.build]
                             else
                               []
                             end
      end

      def filtering_rules_attributes=(attributes)
        @filtering_rules = []

        attributes.each do |_, filtering_rule_attributes|
          next if filtering_rule_attributes["_destroy"] == "1"

          filtering_rule = calendar_configuration.filtering_rules.find_or_initialize_by(id: filtering_rule_attributes[:id])
          filtering_rule.attributes = filtering_rule_attributes.except(:_destroy)

          @filtering_rules.push(filtering_rule) if filtering_rule.valid?
        end
      end

      def calendar_configuration
        @calendar_configuration ||= calendar_configuration_class.find_by(collection_id: collection.id) || calendar_configuration_class.new
      end

      def ibm_notes_usr
        @ibm_notes_usr ||= if calendar_configuration.respond_to?(:ibm_notes_usr)
                              calendar_configuration.ibm_notes_usr
                           end
      end

      def ibm_notes_pwd
        @ibm_notes_pwd ||= if calendar_configuration.respond_to?(:ibm_notes_pwd)
                              calendar_configuration.ibm_notes_pwd
                           end
      end

      def ibm_notes_url
        @ibm_notes_url ||= if calendar_configuration.respond_to?(:ibm_notes_url)
                             calendar_configuration.ibm_notes_url.try(:strip)
                           end
      end

      def without_description
        @without_description ||= if calendar_configuration.respond_to?(:without_description)
                                   calendar_configuration.without_description
                                 end
      end

      def microsoft_exchange_usr
        @microsoft_exchange_usr ||= if calendar_configuration.respond_to?(:microsoft_exchange_usr)
                                      calendar_configuration.microsoft_exchange_usr
                                    end
      end

      def microsoft_exchange_pwd
        @microsoft_exchange_pwd ||= if calendar_configuration.respond_to?(:microsoft_exchange_pwd)
                                      calendar_configuration.microsoft_exchange_pwd
                                    end
      end

      def microsoft_exchange_url
        @microsoft_exchange_url ||= if calendar_configuration.respond_to?(:microsoft_exchange_url)
                                      calendar_configuration.microsoft_exchange_url.try(:strip)
                                    end
      end

      def dummy_ibm_notes_pwd
        if ibm_notes_pwd.present? && ibm_notes_pwd != ENCRYPTED_SETTING_PLACEHOLDER
          ENCRYPTED_SETTING_PLACEHOLDER
        else
          ibm_notes_pwd
        end
      end

      def dummy_microsoft_exchange_pwd
        if microsoft_exchange_pwd.present? && microsoft_exchange_pwd != ENCRYPTED_SETTING_PLACEHOLDER
          ENCRYPTED_SETTING_PLACEHOLDER
        else
          microsoft_exchange_pwd
        end
      end

      def calendars
        @calendars ||= if calendar_configuration.respond_to?(:calendars)
                         calendar_configuration.calendars
                       end
      end

      def calendar_integration
        @calendar_integration ||= begin
          conf = base_calendar_configuration_class.find_by(collection_id: collection.id)
          conf ? conf.integration_name : nil
        end
      end

      def calendar_integration_class
        @calendar_integration_class ||= collection ? collection.calendar_integration : nil
      end

      def collection_container
        collection ? collection.container : nil
      end

      def collection_container_identifier
        collection_container ? collection_container.class.to_s.underscore.gsub('/', '_') : nil
      end

      private

      def google_calendar_configuration_class
        ::GobiertoCalendars::GoogleCalendarConfiguration
      end

      def ibm_notes_configuration_class
        ::GobiertoCalendars::IbmNotesCalendarConfiguration
      end

      def microsoft_exchange_configuration_class
        ::GobiertoCalendars::MicrosoftExchangeCalendarConfiguration
      end

      def base_calendar_configuration_class
        ::GobiertoCalendars::CalendarConfiguration
      end

      def filtering_rule_class
        ::GobiertoCalendars::FilteringRule
      end

      def calendar_configuration_class
        if calendar_integration == 'ibm_notes'
          ::GobiertoCalendars::IbmNotesCalendarConfiguration
        elsif calendar_integration == 'microsoft_exchange'
          ::GobiertoCalendars::MicrosoftExchangeCalendarConfiguration
        elsif calendar_integration == 'google_calendar'
          ::GobiertoCalendars::GoogleCalendarConfiguration
        else
          base_calendar_configuration_class
        end
      end

      def clear_calendar_configuration?
        clear_calendar_configuration == '1' || calendar_integration.blank?
      end

      def save_calendar_configuration
        @calendar_configuration = calendar_configuration.tap do |calendar_configuration_attributes|
          calendar_configuration_attributes.collection_id = collection.id
          calendar_configuration_attributes.integration_name = calendar_integration
          calendar_configuration_attributes.data = calendar_configuration_data
          calendar_configuration_attributes.filtering_rules = filtering_rules
        end

        if @calendar_configuration.valid?
            @calendar_configuration.save
            @calendar_configuration
        else
          promote_errors(@calendar_configuration.errors)
          false
        end
      end

      private

      def encrypted_ibm_notes_pwd
        if ibm_notes_pwd.present? && ibm_notes_pwd != ENCRYPTED_SETTING_PLACEHOLDER
          ::SecretAttribute.encrypt(ibm_notes_pwd)
        elsif ibm_notes_pwd == ENCRYPTED_SETTING_PLACEHOLDER
          calendar_configuration.ibm_notes_pwd
        else
          nil
        end
      end

      def encrypted_microsoft_exchange_pwd
        if microsoft_exchange_pwd.present? && microsoft_exchange_pwd != ENCRYPTED_SETTING_PLACEHOLDER
          ::SecretAttribute.encrypt(microsoft_exchange_pwd)
        elsif microsoft_exchange_pwd == ENCRYPTED_SETTING_PLACEHOLDER
          calendar_configuration.microsoft_exchange_pwd
        else
          nil
        end
      end

      def calendar_configuration_data
        if calendar_integration == 'ibm_notes'
          ibm_notes_configuration_data
        elsif calendar_integration == 'microsoft_exchange'
          microsoft_exchange_configuration_data
        elsif calendar_integration == 'google_calendar'
          google_calendar_configuration_data
        else
         {}
        end
      end

      def ibm_notes_configuration_data
        {
          ibm_notes_usr: ibm_notes_usr,
          ibm_notes_pwd: encrypted_ibm_notes_pwd,
          ibm_notes_url: ibm_notes_url,
          without_description: without_description
        }
      end

      def microsoft_exchange_configuration_data
        {
          microsoft_exchange_usr: microsoft_exchange_usr,
          microsoft_exchange_pwd: encrypted_microsoft_exchange_pwd,
          microsoft_exchange_url: microsoft_exchange_url,
          without_description: without_description
        }
      end

      def google_calendar_configuration_data
        {
          calendars: calendars.select { |c| !c.blank? },
          google_calendar_credentials: calendar_configuration.google_calendar_credentials,
          google_calendar_id: calendar_configuration.google_calendar_id,
          without_description: without_description
        }
      end

    end
  end
end
