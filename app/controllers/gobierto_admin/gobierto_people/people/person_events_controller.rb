module GobiertoAdmin
  module GobiertoPeople
    module People
      class PersonEventsController < People::BaseController
        def index
          @person_events = @person.events.sorted
        end

        def new
          @person_event_form = PersonEventForm.new
        end

        def edit
          @person_event = find_person_event

          @person_event_form = PersonEventForm.new(
            @person_event.attributes.except(*ignored_person_event_attributes)
          )
        end

        def create
          @person_event_form = PersonEventForm.new(
            person_event_params.merge(person_id: @person.id)
          )

          if @person_event_form.save
            redirect_to(
              edit_admin_people_person_event_path(@person, @person_event_form.person_event),
              notice: t(".success")
            )
          else
            render :new
          end
        end

        def update
          @person_event = find_person_event
          @person_event_form = PersonEventForm.new(
            person_event_params.merge(id: params[:id])
          )

          if @person_event_form.save
            redirect_to(
              edit_admin_people_person_event_path(@person, @person_event),
              notice: t(".success")
            )
          else
            render :edit
          end
        end

        private

        def find_person_event
          @person.events.find(params[:id])
        end

        def person_event_params
          params.require(:person_event).permit(
            :title,
            :description,
            :starts_at,
            :ends_at,
            :attachment_file,
            locations_attributes: [:id, :name, :address, :_destroy],
          )
        end

        def ignored_person_event_attributes
          %w(
          created_at updated_at
          state
          )
        end
      end
    end
  end
end
