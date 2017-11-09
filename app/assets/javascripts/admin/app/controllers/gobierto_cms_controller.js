this.GobiertoAdmin.GobiertoCmsController = (function() {
  function GobiertoCmsController() {}

  GobiertoCmsController.prototype.edit = function(sectionId, parentId) {
    _sections(sectionId, parentId);
  };

  GobiertoCmsController.prototype.loadSections = function(sectionSelected) {
    _populateSection(sectionSelected);
    $('#page_parent').empty();
    $('.level_2').show();
    populateParent(sectionSelected, null);
  };

  function _sections(sectionId, parentId) {
    var $level1 = $('.level_1')
    var $level2 = $('.level_2')
    var $section = $('#page_section')
    var $parent = $('#page_parent')

    $( document ).ready(function() {
      if(sectionId != "null") {
        $('.open_level_1').trigger('click');
        $level1.show();
        $level1.show();
      }
    });

    $('.open_level_1').on('click', function(e){
      e.preventDefault();

      // Sections
      $level1.show();
      getSections(sectionId)

      // parent
      $level2.show();

      $parent.empty();

      if($section.val() == null) {
        populateParent($section.val(), "null");
      } else {
        populateParent($section.val(), parentId);
      }
    });

    $('#page_section').change(function(e){
      e.preventDefault();

      var section = $(this).val();

      if(section == 0) {
        $level2.hide();

        // open the new ajax popup
        $.magnificPopup.open({
          closeOnBgClick: false,
          closeBtnInside: true,
          enableEscapeKey: true,
          removalDelay: 65,
          mainClass: 'mfp-fade',
          items: {
          },
          type: 'ajax',
          ajax: {
            settings: {
              url: '/admin/cms/sections/new?remote=true&from_page_widget=true',
              type: 'GET'
            }
          }
        });
      } else {
        $level2.show();
        $parent.empty();
        populateParent(section);
      }
    });
  }

  function _populateSection(sectionSelected) {
    // Get sections
    getSections(sectionSelected)
  }

  function getSections(sectionSelected) {
    // Get sections
    $.getJSON(
        '/admin/cms/sections',
        function(data) {
          appendSections(data['sections'], sectionSelected);
        }
    );
  }

  function appendSections(sections, sectionSelected) {
    var $section = $('#page_section')

    $section.empty();
    numOptions = sections.length;
    for (i = 0; i < numOptions; i++) {
        anOption = document.createElement('option');
        anOption.value = sections[i]['id'];
        anOption.innerHTML = sections[i]['title'];

        $section.append(anOption);
    }
    $("#page_section").append('<option value="0">' + I18n.t('gobierto_admin.gobierto_cms.pages.form.new_section') + '</option>');

    if ("null" != sectionSelected) {
      $section.val(sectionSelected);
    } else {
      $section.val($("#page_section option:first").val());
    }
  }

  function populateParent(section, parentId) {
    var $parent = $('#page_parent')

    // Get children
    $.getJSON(
        '/admin/cms/sections/' + section + '/section_items/',
        function(data) {
          var i, theContainer, theSelect, theOptions, numOptions, anOption;
          theOptions = data['section_items'];

          $parent.append('<option value="0">' + I18n.t('gobierto_admin.gobierto_cms.pages.form.without_parent') + '</option>');

          if(theOptions.length >= 1){
            // Create the container <div>
            appendParents(theOptions, 0);

            if (typeof parentId != "undefined" && parentId != "null") {
              $parent.val(parentId);
              if(parentId == "0") {
                $("#page_parent option:last").attr("disabled","disabled");
              } else {
                $('#page_parent option:selected').next().attr("disabled","disabled");
              }
            } else {
              $parent.val($("#page_parent option:first").val());
              if (typeof parentId != "undefined" && parentId != "null") {
                $("#page_parent option:last").attr("disabled","disabled");
              }
            }
          }
        }
    );
  }

  function appendParents(nodes, level) {
    var $parent = $('#page_parent')

    // Add some <option>s
    numOptions = nodes.length;
    for (i = 0; i < numOptions; i++) {
        anOption = document.createElement('option');
        anOption.value = nodes[i]['id'];
        anOption.innerHTML = ("-".repeat(level)) + " " + nodes[i]['name'];

        $parent.append(anOption);
        if(nodes[i].children.length >= 1) {
          level += 1
          appendParents(nodes[i].children, level)
        }
    }
  }

  return GobiertoCmsController;
})();

this.GobiertoAdmin.gobierto_cms_controller = new GobiertoAdmin.GobiertoCmsController;
