# frozen_string_literal: true

module GobiertoParticipation
  module PollResultsHelpers
    extend ActiveSupport::Concern

    included do
      ESTIMATION_MINIMUM_DAYS = 1

      def results_available?
        published? && closed? && past?
      end

      def unique_answers_count
        answers.select("DISTINCT user_id_hmac").count
      end

      def men_participation_percentage
        if men_unique_answers_count.nonzero?
          (men_unique_answers_count * 100).fdiv(unique_answers_count).round
        else
          0
        end
      end

      def women_participation_percentage
        if women_unique_answers_count.nonzero?
          (women_unique_answers_count * 100).fdiv(unique_answers_count).round
        else
          0
        end
      end

      def men_unique_answers_count
        Hash[answers.pluck(:user_id_hmac, :encrypted_meta).map do |answer|
          [answer[0], SecretAttribute.decrypt(answer[1])[:gender]]
        end].values.select(&:zero?).size
      end

      def women_unique_answers_count
        unique_answers_count - men_unique_answers_count
      end

      def predicted_unique_answers_count
        return unique_answers_count unless answerable?
        return nil if past_days < ESTIMATION_MINIMUM_DAYS

        (length_in_days * average_answers_per_day).round
      end

      def days_left
        (ends_at - Time.zone.now.to_date).to_i
      end

      def past_days
        (Time.zone.now.to_date - starts_at).to_i
      end

      def length_in_days
        (ends_at - starts_at).to_i
      end

      def average_answers_per_day
        (unique_answers_count / past_days.to_f)
      end
    end
  end
end
