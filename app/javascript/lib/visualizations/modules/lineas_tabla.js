import { select, selectAll } from 'd3-selection'
import { scaleTime, scaleLinear, scaleOrdinal, scaleBand } from 'd3-scale'
import { axisBottom, axisRight } from 'd3-axis'
import { format } from 'd3-format'
import { timeParse } from 'd3-time-format'
import { line, curveCardinal } from 'd3-shape'
import { json } from 'd3-request'
import { min, max, extent } from 'd3-array'
import { transition } from 'd3-transition'
import { legendColor } from 'd3-svg-legend'
import { accounting } from 'lib/shared'

const d3 = { select, selectAll, scaleTime, scaleLinear, scaleOrdinal, scaleBand, axisBottom, axisRight, format, timeParse, line, curveCardinal, json, min, max, extent, transition, legendColor }

Array.prototype.unique = function() {
    var a = this.concat();
    for (var i=0; i<a.length; ++i) {
        for (var j=i+1; j<a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
};

export class VisLineasJ {
  constructor(divId, tableID, measure, series) {
    this.container = divId;
    this.tableContainer = tableID;

    // Chart dimensions
    this.containerWidth = null;
    this.tableWidth = null;
    this.margin = { top: 30, right: 60, bottom: 20, left: 20 };
    this.width = null;
    this.height = null;

    // Variable: valid values are total_budget and total_budget_per_inhabitant
    // TODO: check what to do with percentage
    this.measure = measure;
    this.series = series;

    // Scales
    this.xScale = d3.scaleTime();
    this.yScale = d3.scaleLinear();
    this.colorScale = d3.scaleOrdinal();
    this.yScaleTable = d3.scaleBand();
    this.xScaleTable = d3.scaleLinear();

    // Axis
    this.xAxis = d3.axisBottom();
    this.yAxis = d3.axisRight();

    // Data
    this.data = null;
    this.dataChart = null;
    this.dataDomain = null;
    this.kind = null;
    this.dataYear = null;
    this.dataTitle = null;
    this.lastYear = null;
    this.maxYear = (new Date()).getFullYear();

    // Legend
    this.legendEvolution = d3.legendColor();

    // Objects
    this.tooltip = null;
    this.formatPercent = this.measure == 'percentage' ? d3.format('%') : d3.format(".0f");
    this.parseDate = d3.timeParse("%Y");
    this.line = d3.line();

    // Chart objects
    this.svgLines = null;
    this.svgTable = null;
    this.chart = null;
    this.focus = null;

    // Constant values
    this.radius = 4;
    this.heavyLine = 3;
    this.mediumLine = 2;
    this.lightLine = 1;
    this.opacity = .7;
    this.opacityLow = .4;
    this.duration = 400;
    this.mainColor = '#F69C95';
    this.darkColor = '#B87570';
    this.softGrey = '#d6d5d1';
    this.darkGrey = '#554E41';
    this.blue = '#2A8998';
    this.meanColorRange = ['#F4D06F', '#F8B419', '#DA980A', '#2A8998'];
    this.comparatorColorRange = ['#2A8998', '#F8B419', '#b82e2e', '#66aa00', '#dd4477',
                                  '#636363', '#273F8E', '#e6550d', '#990099', '#06670C'];
                                    // azul main, amarillo main, rojo g scale, verde g, verde, violeta,
                                    // gris

    this.niceCategory = null;
  }

  render(urlData) {
    $(this.container).html('');
    $(this.tableContainer).html('');

    var self = this

    // Chart dimensions
    this.containerWidth = parseInt(d3.select(this.container).style('width'), 10);
    if (isNaN(this.containerWidth)) {
      this.containerWidth = 0;
    }

    if (d3.select(this.tableContainer).size() !== 0) {
      this.tableWidth = parseInt(d3.select(this.tableContainer).style('width'), 10);
    } else {
      this.tableWidth = 0;
    }

    this.margin.right = this.measure == 'per_person' ? this.containerWidth * .07 : this.containerWidth * .15;

    this.width = this.containerWidth - this.margin.left - this.margin.right;
    this.height = (this.containerWidth / 2.6) - this.margin.top - this.margin.bottom;

    if (this.height < 230) {
      this.height = 230;
    }

    // Append svg
    this.svgLines = d3.select(this.container).append('svg')
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom + 10)
        .attr('class', 'svg_lines')
        .append('g')
        .attr('transform', 'translate(' + 0 + ',' + this.margin.top + ')');

    // Set nice category
    this.niceCategory = {
      "mean_national": I18n.t("gobierto_common.visualizations.mean_national"),
      "mean_autonomy": I18n.t("gobierto_common.visualizations.mean_autonomy"),
      "mean_province": I18n.t("gobierto_common.visualizations.mean_province"),
      "G": "Gasto/habitante",
      "I": "Ingreso/habitante",
      "percentage": "% sobre el total"
    }

    // Load the data
    d3.json(urlData, function(error, jsonData){
      if (error) throw error;

      this.data = jsonData;

      var budgetsData = (this.data["budgets"]["per_person"] || this.data["budgets"]["total_budget"]);
      var yearsWithData = budgetsData.map(function(x) {
        var dates = x["values"].map(function(value) {
          return value["date"];
        });
        return dates;
      });

      yearsWithData = [].concat.apply([], yearsWithData); // Flatten array

      var uniqueYears = []
      yearsWithData.forEach(function(year) {
          if (uniqueYears.indexOf(year) === -1) {
            uniqueYears.push(year);
          }
      });

      if (uniqueYears.length < 2) {
        $('#lines_chart_wrapper').html('');
        $('#lines_chart_wrapper_separator').remove();
        return;
      }

      this.data.budgets[this.measure].forEach(function(d) {
        d.values.forEach(function(v) {
          v.date = this.parseDate(v.date);
          v.name = d.name;
        }.bind(this));
      }.bind(this));

      this.dataChart = this.data.budgets[this.measure];
      this.kind = this.data.kind;
      this.dataYear = this._defaultYearForVerticalLine(this.data);
      this.lastYear = this.parseDate(this.data.year).getFullYear(); // For the mouseover interaction
      if (this.lastYear > this.maxYear) {
        this.dataYear = new Date(this.maxYear + "-01-01")
        this.lastYear = this.maxYear;
      }
      this.dataTitle = this.data.title;

      ////// Complete the dataTable.
      // Get all the years
      var years = [];

      this.dataChart.map(function(d) {
        d.values.map(function(v) {
          if (years.map(Number).indexOf(+v.date) == -1) {
            years.push(v.date)
          }
        });
      });

      // Sort them
      years = years.sort(d3.ascending)

      // Create a values object for every municipality for every year
      this.dataChart.map(function(d) {

        if (d.values.length != years.length) {
          years.forEach(function(year) {

            // If the year does not exist
            // Push a new object
            var aux = d.values.filter(function(v) {
              return v.date == year;
            });

            if (aux.length == 0) {
              var obj = {
                date: year,
                dif: null,
                name: d.name,
                value: null
              }
              d.values.push(obj)
            }
          });
        }
      });


      this.dataDomain = [d3.min(this.dataChart.map(function(d) { return d3.min(d.values.map(function(v) { return v.value; })); })),
              d3.max(this.dataChart.map(function(d) { return d3.max(d.values.map(function(v) { return v.value; })); }))];

      var min = 0;
      if (this.dataDomain[0] > 100000) {
        min = Math.floor((this.dataDomain[0] * .1)/10000.0) * 10000;
      } else {
        min = Math.floor((this.dataDomain[0] * .1)/100.0) * 100;
      }

      var max = 0;
      if (this.dataDomain[1] > 100000) {
        max = Math.floor((this.dataDomain[1] * 1.2)/10000.0) * 10000;
      } else {
        max = Math.ceil(this.dataDomain[1] * 1.2);
      }

      // Set the scales
      this.xScale
        .domain(d3.extent(years))
        .range([this.margin.left, this.width - (this.margin.right)]);

      this.yScale
        // .domain([this.dataDomain[0] * .3, this.dataDomain[1] * 1.2])
        .domain([min, max])
        .range([this.height, this.margin.top]);


      this.colorScale
        .range(this.series == 'means' ? this.meanColorRange : this.comparatorColorRange)
        .domain(this.dataChart.map(function(d) { return d.name; }));

      // Define the axis
      this.xAxis
          .tickValues(this._xTickValues(years))
          .scale(this.xScale);

      this.yAxis
          .scale(this.yScale)
          .tickValues(this._tickValues(this.yScale))
          .tickFormat(function(d) { return accounting.formatMoney(d, "€", 0, I18n.t("number.currency.format.delimiter"), I18n.t("number.currency.format.separator")); })
          .tickSize(-(this.width - (this.margin.right + this.margin.left - 20)));


      // Define the line
      this.line
        .curve(d3.curveCardinal)
        .x(function(d) { return this.xScale(d.date); }.bind(this))
        .y(function(d) { return this.yScale(d.value); }.bind(this));


      // --> DRAW THE AXIS
      this.svgLines.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(" + 0 + "," + this.height + ")")
          .call(this.xAxis);

      this.svgLines.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(" + (this.width - this.margin.right) + ",0)")
          .call(this.yAxis);

      // Change ticks color
      d3.selectAll('.axis').selectAll('text')
        .attr('fill', this.darkGrey)
        .style('font-size', '12px');

      d3.selectAll('.y.axis').selectAll('text')
        .attr("transform", "translate(10,0)");

      d3.selectAll('.x.axis').selectAll('text')
        .attr("transform", "translate(0,10)");

      d3.selectAll('.y.axis').selectAll('path')
        .attr('stroke', 'none');

       d3.selectAll('.axis').selectAll('line')
        .attr('stroke', this.softGrey);

      // --> DRAW VERTICAL LINE
      this.svgLines.selectAll('.v_line')
            .data([this.dataYear])
            .enter()
          .append('line')
            .attr('class', 'v_line')
            .attr('x1', function(d) { return this.xScale(d); }.bind(this))
            .attr('y1', this.margin.top)
            .attr('x2', function(d) { return this.xScale(d); }.bind(this))
            .attr('y2', this.height)
            .style('stroke', this.darkGrey);

      // --> DRAW THE LINES
      this.chart = this.svgLines.append('g')
          .attr('class', 'evolution_chart');

      this.chart.append('g')
          .attr('class', 'lines')
        .selectAll('path')
          .data(this.dataChart)
          .enter()
        .append('path')
          .attr('class', function(d) { return 'evolution_line ' + this._normalize(d.name); }.bind(this))
          .attr('d', function(d) { return this.line(d.values.filter(function(v) { return v.value != null; })); }.bind(this))
          .style('stroke', function(d) { return this.colorScale(d.name); }.bind(this))
          .style('stroke-width', function(d, i) {
            if (this.series == 'means')
              return i == 3 ? this.heavyLine : this.lightLine;
            else
              return this.lightLine;
          }.bind(this))


      // Add dot to lines
      this.chart.selectAll('g.dots')
        .data(this.dataChart)
        .enter()
        .append('g')
        .attr('class', 'dots')
        .selectAll('circle')
        .data(function(d) {
          return d.values.filter(function(v) {
            return v.value != null;
          });
        })
        .enter()
        .append('circle')
        .attr('class', function(d) {
          return 'dot_line ' + this._normalize(d.name) + ' x' + d.date.getFullYear();
        }.bind(this))
        .attr('cx', function(d) {
          return this.xScale(d.date);
        }.bind(this))
        .attr('cy', function(d) {
          return this.yScale(d.value);
        }.bind(this))
        .attr('r', this.radius)
        .style('fill', function(d) {
          return this.colorScale(d.name);
        }.bind(this))
        .on('mouseover', function() {
          var selected = this,
            selectedClass = selected.classList,
            selectedData = d3.select(selected).data()[0];

          var dataChartFiltered = self.dataChart.map(function(d) {
            return d.values.filter(function(v) {
              return v.date.getFullYear() == selectedData.date.getFullYear();
            })[0];
          });


          if (self.lastYear != selectedData.date.getFullYear()) {
            // Hide table figures and update text
            // Year header
            d3
              .selectAll(self.tableContainer + ' .year_header')
              .transition()
              .duration(self.duration / 2)
              .style('opacity', 0)
              .text(selectedData.date.getFullYear())
              .transition()
              .duration(self.duration)
              .style('opacity', 1);

            // Values
            d3
              .selectAll(self.tableContainer + ' .value')
              .transition()
              .duration(self.duration / 2)
              .style('opacity', 0)
              .text(function(d) {
                var newValue = dataChartFiltered.filter(function(value) {
                  return value.name == d.name;
                })
                d.value = newValue[0].value
                return d.value != null ? accounting.formatMoney(d.value, "€", 2, I18n.t("number.currency.format.delimiter"), I18n.t("number.currency.format.separator")) : '-- €';
              })
              .transition()
              .duration(self.duration)
              .style('opacity', 1);

            // Difs
            d3
              .selectAll(self.tableContainer + ' .dif')
              .transition()
              .duration(self.duration / 2)
              .style('opacity', 0)
              .text(function(d) {
                var newValue = dataChartFiltered.filter(function(dif) {
                  return dif.name == d.name;
                })
                d.dif = newValue[0].dif
                if (d.dif != null) {
                  return d.dif <= 0 ? d.dif.toLocaleString(I18n.locale) + ' %' : '+' + d.dif.toLocaleString(I18n.locale) + ' %';
                } else {
                  return '-- %'
                }

              })
              .transition()
              .duration(self.duration)
              .style('opacity', 1);
          }

          self.lastYear = selectedData.date.getFullYear();

          self.svgLines.selectAll('.v_line')
            .transition()
            .duration(self.duration / 2)
            .attr('x1', function() {
              return self.xScale(selectedData.date);
            }.bind(this))
            .attr('x2', function() {
              return self.xScale(selectedData.date);
            }.bind(self));

          d3.select(selected)
            .transition()
            .duration(self.duration)
            .attr('r', self.radius * 1.5);

          self.svgLines.selectAll('.dot_line')
            .transition()
            .duration(self.duration)
            .filter(function(d) {
              return d.name != selectedClass[1] && 'x' + d.date.getFullYear() != selectedClass[2];
            })
            .style('opacity', self.opacityLow);

          self.svgLines.selectAll('.evolution_line')
            .transition()
            .duration(self.duration)
            .filter(function(d) {
              return d.name != selectedClass[1];
            })
            .style('opacity', self.opacityLow);
        })
        .on('mouseout', function() {
          this.svgLines.selectAll('.dot_line')
            .transition()
            .duration(this.duration)
            .attr('r', this.radius)
            .style('opacity', 1);

          this.svgLines.selectAll('.evolution_line')
            .transition()
            .duration(this.duration)
            .style('opacity', 1);
        }.bind(this));

      // --> ADD THE CHART TITLE
      this.svgLines.append('text')
          .attr('class', 'chart_title')
          .attr('x', this.margin.left)
          .attr('y', this.margin.top)
          .attr('dx', -this.margin.left)

          .attr('dy', -this.margin.top * 1.3)
          .attr('text-anchor', 'start')
          .text(this.dataTitle)
          .style('fill', this.darkGrey)
          .style('font-size', '1.2em');

      // --> DRAW THE 'TABLE'

      // Set columns and rows
      var columns = ['color', 'name', 'value', 'dif']

      var rows = this.colorScale.domain();
      rows.push('header');

      var colors = {
        'mean_province': 'province',
        'mean_autonomy': 'com',
        'mean_national': 'country'

      }
      // Set scales

      this.yScaleTable.domain(rows).rangeRound([this.height, 0]);
      this.xScaleTable.domain([0,1]).range([0, this.tableWidth]);

      var table = d3.select(this.tableContainer).append('table'),
        thead = table.append('thead'),
        tbody = table.append('tbody');


      // append the header row
      thead.append("tr")
          .selectAll("th")
          .data(columns)
          .enter()
          .append("th")
          .attr('title', function(column) { return column; })
          .attr('class', function(column) {
            if (column == 'dif') {
              return 'right per_change'
            } else if (column == 'value') {
              return 'right year_header'
            }
          }.bind(this))
          .html(function(column) {
            if ((column == 'color') || (column == 'name')) {
              return '<span style="display:none" aria-hidden="true">WCAG 2.0 AA</span>';
            } else if (column == 'dif') {
              return I18n.t("gobierto_common.visualizations.previous_year_diff");
            } else if (column == 'value') {
              return this.dataYear.getFullYear();
            }
          }.bind(this));

      thead.select('.year_header')
          .style('font-size', '14px')

      // create a row for each object in the data
      rows = tbody.selectAll("tr")
          .data(this.dataChart.reverse())
          .enter()
          .append("tr")
          .attr('class', function(d) { return this._normalize(d.name); }.bind(this))
          .on('mouseover', function () {
            var classed = this.classList[this.classList.length - 1]

            self.svgLines.selectAll('.dot_line')
              .transition()
              .duration(self.duration)
              .filter(function(d) { return self._normalize(d.name) !== classed; }.bind(self))
              .style('opacity', self.opacityLow);

            self.svgLines.selectAll('.evolution_line')
              .transition()
              .duration(self.duration)
              .filter(function(d) { return self._normalize(d.name) !== classed; }.bind(self))
              .style('opacity', self.opacityLow);
          })
          .on('mouseout', function () {
            this.svgLines.selectAll('.dot_line')
              .transition()
              .duration(this.duration)
              .attr('r', this.radius)
              .style('opacity', 1);

            this.svgLines.selectAll('.evolution_line')
              .transition()
              .duration(this.duration)
              .style('opacity', 1);
          }.bind(this));

      // create a cell in each row for each column
      rows.selectAll("td")
          .data(function(row) {

            var dataChartFiltered = row.values.filter(function(v) {
                    return v.date.getFullYear() == this.dataYear.getFullYear();
                  }.bind(this))

            dataChartFiltered.map(function(d) { return colors[d.name] != undefined ? d['color']= 'le le-' + colors[d.name] : d['color'] = 'le le-place'; });

            return columns.map(function(column) {
              var value, classed;
                if (column == 'name') {
                  value = this.niceCategory[dataChartFiltered[0][column]] != undefined ? this.niceCategory[dataChartFiltered[0][column]] : dataChartFiltered[0][column];
                  classed = this._normalize(dataChartFiltered[0].name)

                } else if (column == 'value') {
                  value = dataChartFiltered[0][column] != null ? accounting.formatMoney(dataChartFiltered[0][column], "€", 2, I18n.t("number.currency.format.delimiter"), I18n.t("number.currency.format.separator")) : '-- €'
                  classed = 'value right ' + this._normalize(dataChartFiltered[0].name)
                } else if (column == 'dif') {
                  if (dataChartFiltered[0][column] != null) {
                    value = dataChartFiltered[0][column] > 0 ? '+' +dataChartFiltered[0][column].toLocaleString(I18n.locale) + ' %' : dataChartFiltered[0][column].toLocaleString(I18n.locale) + ' %'
                  } else {
                    value = '--%'
                  }
                  classed = 'dif right ' + this._normalize(dataChartFiltered[0].name)
                } else {
                  value = dataChartFiltered[0][column]
                  classed = this._normalize(dataChartFiltered[0].name)
                }
                return { column: column,
                        value: value,
                        name: dataChartFiltered[0].name,
                        classed: classed
                      };
            }.bind(this));

          }.bind(this))
          .enter()
        .append("td")
          .attr('class', function(d) { return d.classed ; })
          .html(function(d, i) {return i != 0 ? d.value : '<i class="' + d.value + '"></i>'; }.bind(this));

          var bulletsColors = this.colorScale.range();

          // Replace bullets colors
          $(this.container + '_wrapper .le').each(function(i, v){
            var color = bulletsColors[i];
            $(v).css('background', color);

            var $parent = $(v).parent();
            var cssClass = $parent.attr('class');

            $(this.container + '_wrapper path.' + cssClass).css('stroke', color);
            $(this.container + '_wrapper circle.' + cssClass).css('fill', color);
          }.bind(this));
    }.bind(this)); // end load data
  }

  //PRIVATE
  _tickValues(scale) {
    var range = scale.domain()[1] - scale.domain()[0];
    var a = range/4;
    return [scale.domain()[0], scale.domain()[0] + a, scale.domain()[0] + (a * 2), scale.domain()[1] - a, scale.domain()[1]];
  }

  _xTickValues(years) {
    return [new Date(2010,0,1), new Date(2011,0,1), new Date(2012, 0, 1), new Date(2013,0,1), new Date(2014,0,1), new Date(2015,0,1)].concat(years).unique();
  }

  _defaultYearForVerticalLine(data) {
    /**
    * Returns the most recent year that has data for at least two different municipalities.
    */
    var yearsDataItems = {}
    var measureType = Object.keys(data.budgets)[0];

    data.budgets[measureType].forEach(function(x) { x.values.forEach(function(y) {
      var year = y.date.getFullYear();
      yearsDataItems[year] = (yearsDataItems[year] === undefined ? 1 : yearsDataItems[year] + 1);
    }); });

    if (yearsDataItems[data.year] > 1) return new Date(data.year, 0, 1);

    var yearsWithData = Object.keys(yearsDataItems).sort().reverse();
    var chosenYear = undefined;

    yearsWithData.forEach(function(year) {
      if (yearsDataItems[year] > 1 && chosenYear == undefined) {
        chosenYear = new Date(year, 0, 1);
      }
    });

    // set default date if it's undefined
    return chosenYear || new Date();
  }

  _mouseover() {


  }

  _units() {
    if (this.measure == 'total_budget'){
      return ' €';
    } else {
      return ' €/hab';
    }
  }

  _normalize(str) {
    var from = "1234567890ÃÀÁÄÂÈÉËÊÌÍÏÎÒÓÖÔÙÚÜÛãàáäâèéëêìíïîòóöôùúüûÑñÇç ‘/&().!,'",
        to = "izeasgtogoAAAAAEEEEIIIIOOOOUUUUaaaaaeeeeiiiioooouuuunncc_______",
        mapping = {};

    for (let i = 0, j = from.length; i < j; i++) {
      mapping[from.charAt(i)] = to.charAt(i);
    }

    var ret = [];
    for (let i = 0, j = str.length; i < j; i++) {
      var c = str.charAt(i);
      if (Object.prototype.hasOwnProperty.call(mapping, str.charAt(i))) {
        ret.push(mapping[c]);
      }
      else {
        ret.push(c);
      }
    }

    return ret.join('').toLowerCase();
  }
}
