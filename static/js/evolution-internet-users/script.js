var continent = null,
    min_year = 1990,
    max_year = 2012;

// Various accessors that specify the four dimensions of data to visualize.
function x(d) { return d['NY.GDP.PCAP.CD'] }
function y(d) { return d['IT.NET.USER.P2'] }
function radius(d) { return d['SP.POP.TOTL'] }
function color(d) { return d.region }
function key(d) { return d.name }

// Chart dimensions.
var margin = {top: 19.5, right: 19.5, bottom: 39.5, left: 39.5},
    width = containerwidth('#vis') - margin.right,
    height = width / 1.6;

// Various scales. These domains make assumptions of data, naturally.
var xScale = d3.scale.log().domain([100, 2e5]).range([0, width]),
    yScale = d3.scale.linear().domain([0, 100]).range([height, 0]),
    radiusScale = d3.scale.sqrt().domain([0, 1500000000]).range([1, 40]),
    colorScale = d3.scale.category10();

// The x & y axes.
var xAxis = d3.svg.axis().orient('bottom').scale(xScale).ticks(10, d3.format(',d')),
    yAxis = d3.svg.axis().scale(yScale).orient('left');

// Create the SVG container and set the origin.
var svg = d3.select('#vis').append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// Add the x-axis.
svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(0,' + height + ')')
    .call(xAxis);

// Add the y-axis.
svg.append('g')
    .attr('class', 'y axis')
    .call(yAxis);

// Add an x-axis label.
svg.append('text')
    .attr('class', 'x label')
    .attr('text-anchor', 'end')
    .attr('x', width)
    .attr('y', height - 6)
    .text('GDP per capita (current US$)');

// Add a y-axis label.
svg.append('text')
    .attr('class', 'y label')
    .attr('text-anchor', 'end')
    .attr('y', 6)
    .attr('dy', '.75em')
    .attr('transform', 'rotate(-90)')
    .text('Internet users by 100 people');

// Add the year label; the value is set on transition.
var label = svg.append('text')
    .attr('class', 'year label')
    .attr('text-anchor', 'end')
    .attr('y', height - 24)
    .attr('x', width)
    .text(min_year);

// clipPath to hide part of circles outside of chart area
svg.append('clipPath')
  .attr('id', 'chart-area')
  .append('rect')
    .attr('class', 'fillblue')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height);

// Load the data.
d3.json('/json/evolution-internet-users.json', function(errors, nations) {

  // A bisector since many nation's data is sparsely-defined.
  var bisect = d3.bisector(function(d) { return d[0]; });

  // Add a dot per nation. Initialize the data at   , and set the colors.
  var dot = svg.append('g')
      .attr('class', 'dots')
      .attr('clip-path', 'url(#chart-area)')
    .selectAll('.dot')
      .data(interpolateData(min_year))
    .enter().append('circle')
      .attr('class', 'dot')
      .style('fill', function(d) { return colorScale(color(d)); })
      .call(position)
      .sort(order);

  // Add a title.
  dot.append('title')
      .text(function(d) { return d.name; });

  // Add an overlay for the year label.
  var box = label.node().getBBox();

  var overlay = svg.append('rect')
        .attr('class', 'overlay')
        .attr('x', box.x)
        .attr('y', box.y)
        .attr('width', box.width)
        .attr('height', box.height)
        .on('mouseover', enableInteraction);

  // Start a transition that interpolates the data based on year.
  svg.transition()
      .duration(5000)
      .ease('linear')
      .tween('year', tweenYear)
      .each('end', enableInteraction);

  // Positions the dots based on data.
  function position(dot) {
    dot.filter(function(d){
        if (x(d) && y(d) > 0 && radius(d) && (!continent || continent == d.region)) {
            return d
        }
      })
      .attr('cx', function(d) { return xScale(x(d)) })
      .attr('cy', function(d) { return yScale(y(d)) })
      .attr('r', function(d) { return radiusScale(radius(d)) });
  }

  // Defines a sort order so that the smallest dots are drawn on top.
  function order(a, b) {
    return radius(b) - radius(a);
  }

  // After the transition finishes, you can mouseover to change the year.
  function enableInteraction() {
    var yearScale = d3.scale.linear()
        .domain([min_year, max_year])
        .range([box.x + 10, box.x + box.width - 10])
        .clamp(true);

    // Cancel the current transition, if any.
    svg.transition().duration(0);

    overlay
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        .on('mousemove', mousemove)
        .on('touchmove', mousemove);

    function mouseover() {
      label.classed('active', true);
    }

    function mouseout() {
      label.classed('active', false);
    }

    function mousemove() {
      displayYear(yearScale.invert(d3.mouse(this)[0]));
    }
  }

  // Tweens the entire chart by first tweening the year, and then the data.
  // For the interpolated data, the dots and label are redrawn.
  function tweenYear() {
    var year = d3.interpolateNumber(min_year, max_year);
    return function(t) { displayYear(year(t)); };
  }

  // Updates the display to show the specified year.
  function displayYear(year) {
    dot.data(interpolateData(Math.round(year)), key).call(position).sort(order);
    label.text(Math.round(year));
  }

  function interpolateData(year) {
    return nations.map(function(d) {
      return {
        name: d.name,
        region: d.region,
        'NY.GDP.PCAP.CD': interpolateValues(d['NY.GDP.PCAP.CD'], year),
        'IT.NET.USER.P2': interpolateValues(d['IT.NET.USER.P2'], year),
        'SP.POP.TOTL': interpolateValues(d['SP.POP.TOTL'], year)
      };
    });
  }

  // Finds (and possibly interpolates) the value for the specified year.
  function interpolateValues(values, year) {
    for (i in values) {
      if (year == values[i][0] && null != values[i][1]) {
        return values[i][1]
      }
    }
    return null
  }

});
