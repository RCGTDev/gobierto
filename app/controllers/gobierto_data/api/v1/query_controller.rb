# frozen_string_literal: true

module GobiertoData
  module Api
    module V1
      class QueryController < BaseController

        # GET /api/v1/data?sql=SELECT%20%2A%20FROM%20table_name
        # GET /api/v1/data.json?sql=SELECT%20%2A%20FROM%20table_name
        # GET /api/v1/data.csv?sql=SELECT%20%2A%20FROM%20table_name
        # GET /api/v1/data.xlsx?sql=SELECT%20%2A%20FROM%20table_name
        def index
          query_result = execute_query(params[:sql] || {})

          if query_result.is_a?(Hash) && query_result.has_key?(:errors)
            render json: query_result, status: :bad_request, adapter: :json_api
          else
            respond_to do |format|
              format.json do
                render json: { data: query_result.delete(:result), meta: query_result }, adapter: :json_api
              end

              format.csv do
                render_csv(csv_from_query_result(query_result.fetch(:result, ""), csv_options_params))
              end

              format.xlsx do
                send_data xlsx_from_query_result(query_result.fetch(:result, "")).read, filename: "data.xlsx"
              end
            end
          end
        end

        private

        def execute_query(sql)
          GobiertoData::Connection.execute_query(current_site, Arel.sql(sql), include_draft: valid_preview_token?)
        end

      end
    end
  end
end
